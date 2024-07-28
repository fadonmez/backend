import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWordDto } from './dto';
import { OpenAiService } from 'src/openai/openai.service';
import { Request } from 'express';
import { UserService } from 'src/user/user.service';
import { CategoryService } from 'src/category/category.service';
import { languages } from 'src/utils/constants';

@Injectable()
export class WordService {
  constructor(
    private prisma: PrismaService,
    private openAiService: OpenAiService,
    private userService: UserService,
    private categoryService: CategoryService,
  ) {}

  async createWord(createWordDto: CreateWordDto, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };
      if (createWordDto.userId !== decodedUserInfo.id) {
        throw new ForbiddenException();
      }
      const { user } = await this.userService.getUserById(
        createWordDto.userId,
        req,
      );
      const language = user.languages.find(
        (language) => language.languageCode === createWordDto.languageCode,
      );
      if (!language) {
        throw new ForbiddenException();
      }

      const category = await this.categoryService.getCategoryById(
        createWordDto.categoryId,
        req,
      );

      if (!category) {
        throw new ForbiddenException();
      }
      const userWords: any = await this.getUserWords(createWordDto.userId);
      if (user.type === 'NORMAL' && userWords.length >= 25) {
        throw new ForbiddenException('You have reached the limit of 25 words ');
      }

      //TODO: CHECK WORD DETECTION SYSTEM

      const existingWordUser = userWords?.find(
        (word: any) =>
          word.wordName === createWordDto.wordName.toLowerCase().trim(),
      );
      if (existingWordUser) {
        throw new ForbiddenException('Word already exists in your account');
      }
      const existingWord: any = await this.prisma.word.findUnique({
        where: { wordName: createWordDto.wordName.toLowerCase().trim() },
        include: { translations: true },
      });

      if (existingWord) {
        if (existingWord.languageCode !== createWordDto.languageCode)
          throw new ForbiddenException(
            'Please add a word from your target language!',
          );
        const existingTranslation: any = existingWord.translations.find(
          (translation: any) =>
            translation.languageCode === createWordDto.nativeLang,
        );
        if (existingTranslation) {
          await this.prisma.userWord.create({
            data: {
              word: {
                connect: { id: existingWord.id },
              },
              user: {
                connect: { id: createWordDto.userId },
              },
              category: {
                connect: { id: createWordDto.categoryId },
              },
            },
          });
          return {
            message: 'Word created successfully v existing translation',
          };
        }
      }

      const userPrompt = {
        wordName: createWordDto.wordName,
        targetLang: languages[createWordDto.languageCode],
        nativeLang: languages[createWordDto.nativeLang],
      };

      const systemPrompt = `You are a translation tool. You receive three inputs from the user: "wordName" for the name of the word, "targetLang" for the language of the word and "nativeLang" for the translation language. You will translate ${userPrompt.wordName} from ${userPrompt.targetLang} to ${userPrompt.nativeLang}. Return error if "wordName" contains extra characters. And you will give a sample sentence of up to 12 words in ${userPrompt.targetLang} containing the word. Before translating, you will determine in which language "wordName" is a word. If everything is OK, it returns {"translation": (translatedWord), "example": (example), "wordLanguage": (determinedLanguageCode), "wordLevel": (levelOfTheWord. Only A1,A2,B1,B2,C1,C2)}. If any other problem occurs, it returns "error": "Word translation failed. We apologize for the error."`;

      const systemPromptUpdate = `You're a translation tool. You get three inputs from the user: "wordName" for the word's name, "targetLang" for the word's language, and "nativeLang" for the translation language. You will translate ${userPrompt.wordName} from ${userPrompt.targetLang} to ${userPrompt.nativeLang}. Before translating, you will determine in which language "wordName" is a word. If everything's fine, return {"translation": (translatedWord)}. If another issue arises, return "error": "Word translation failed. We apologize for the error." `;

      if (existingWord) {
        // if there is an exampleWord then use existingword's example
        const result: any = await this.openAiService.translate(
          systemPromptUpdate,
          userPrompt,
        );
        if (result.error) {
          throw new ForbiddenException(
            'Please check your inputs and try again',
          );
        }
        const translationValue: any = result.translation;
        await this.prisma.word.update({
          where: { id: existingWord.id },
          data: {
            translations: {
              create: {
                languageCode: createWordDto.nativeLang,
                translationValue: translationValue.toLowerCase().trim(),
              },
            },
          },
        });
        await this.prisma.userWord.create({
          data: {
            word: {
              connect: { id: existingWord.id },
            },
            user: {
              connect: { id: createWordDto.userId },
            },
            category: {
              connect: { id: createWordDto.categoryId },
            },
          },
        });
        return {
          message: 'Word created succesfully w existingWord update translate',
        };
      }
      // if there is no existingword create brand new word with example
      const result: any = await this.openAiService.translate(
        systemPrompt,
        userPrompt,
      );

      if (result.error) throw new ForbiddenException(result.error);

      if (result.wordLanguage !== createWordDto.languageCode)
        throw new ForbiddenException(
          'Please add a word from your target Language',
        );

      const translationValue: any = result.translation;

      await this.prisma.word.create({
        data: {
          languageCode: createWordDto.languageCode,
          wordName: createWordDto.wordName.toLowerCase().trim(),
          wordLevel: result.wordLevel.toUpperCase(),
          example: result.example, // Açıklamanızda sağlanan örneğe dayanarak
          translations: {
            create: [
              {
                languageCode: createWordDto.nativeLang,
                translationValue: translationValue.toLowerCase().trim(),
              },
            ],
          },
          userWords: {
            create: {
              category: {
                connect: { id: createWordDto.categoryId },
              },
              user: {
                // Burada, kendi modelinize ve alan isimlerinize uygun olarak güncellenmelidir.
                connect: { id: createWordDto.userId },
              },
            },
          },
        },
      });
      return { message: 'Word created successfuly' };
    } catch (error) {
      throw error;
    }
  }

  async deleteWord(id: string, req: Request) {
    try {
      const decodedUserInfo = req.user as { id: string; email: string };
      const word = await this.prisma.userWord.findUnique({
        where: { id },
      });

      if (!word) {
        throw new NotFoundException();
      }

      if (word.userId !== decodedUserInfo.id) {
        throw new ForbiddenException();
      }

      await this.prisma.userWord.delete({
        where: {
          id,
        },
      });

      return { message: 'Word deleted successfully', statusCode: 200 };
    } catch (error) {
      switch (error.statusCode) {
        case 404:
          throw new NotFoundException();
        case 403:
          throw new ForbiddenException();
        default:
          throw error;
      }
    }
  }

  async getAllWords(languageCode: string) {
    const length = await this.prisma.word.count({
      where: { languageCode: languageCode },
    });
    const skip = Math.max(0, Math.floor(Math.random() * length) - 20);

    try {
      const { words } = await this.prisma.language.findUnique({
        where: { languageCode: languageCode },
        select: {
          words: {
            take: 20,
            skip: skip,
          },
        },
      });
      return words;
    } catch (error) {
      return null;
    }
  }

  async getUserWords(id: string | undefined) {
    try {
      const res = await this.prisma.user.findUnique({
        where: {
          id: id,
        },
        select: {
          UserWord: {
            include: {
              word: {
                include: {
                  translations: true,
                },
              },
            },
          },
        },
      });
      const { UserWord } = res;
      const formattedWords = UserWord.map((word) => {
        return word.word;
      });
      return formattedWords;
    } catch (error) {
      return null;
    }
  }

  async getWordByName(word: string, languageCode: string) {
    try {
      const result = await this.prisma.word.findUnique({
        where: { wordName: word.toLowerCase(), languageCode },
        include: {
          translations: {
            select: {
              translationValue: true,
              languageCode: true,
            },
          },
        },
      });

      return result;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
