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
      const userWords: any = await this.getAllWords(createWordDto.userId);
      if (category.userWords.length >= 200) {
        throw new ForbiddenException(
          'You have reached the limit of 200 words per category',
        );
      }
      const existingWord: any = await this.prisma.word.findUnique({
        where: { wordName: createWordDto.wordName },
        include: { translations: true },
      });
      const existingWordUser = userWords?.find(
        (word: any) => word.wordName === createWordDto.wordName,
      );
      if (existingWordUser) {
        throw new ForbiddenException('Word already exists in your language');
      }
      if (existingWord) {
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
      const systemPrompt = `You are a translation tool. You receive three inputs from the user: "wordName" for the name of the word, "targetLang" for the language of the word and "nativeLang" for the translation language. You will translate "wordName" from "targetLang" to "nativeLang". And give a sample sentence of max 20 words in "targetLang".  If "wordName" is not in "targetLang", it will return "error": "Please add a word from your target language!" If everything is OK, it returns {"translation": (translatedWord), "example": (example)}. If any other problem occurs, it returns "error": "Something went wrong". `;

      const systemPromptUpdate = `You're a translation tool. You get three inputs from the user: "wordName" for the word's name, "targetLang" for the word's language, and "nativeLang" for the translation language. You will translate "wordName" from "targetLang" to "nativeLang". If "wordName" isn't in "targetLang", return "error": "Please add a word from your target language!" If everything's fine, return {"translation": (translatedWord)}. If another issue arises, return "error": "Something went wrong". `;
      const userPrompt = {
        wordName: createWordDto.wordName,
        targetLang: createWordDto.languageCode,
        nativeLang: createWordDto.nativeLang,
      };
      if (existingWord) {
        // if there is an exampleWord then use existingword's example
        const result: any = await this.openAiService.translate(
          systemPromptUpdate,
          userPrompt,
        );
        if (result.error) {
          console.log('Sa');
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
      const translationValue: any = result.translation;

      await this.prisma.word.create({
        data: {
          languageCode: createWordDto.languageCode,
          wordName: createWordDto.wordName.toLowerCase().trim(),
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
      console.log(word.userId, decodedUserInfo.id);
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

      return { message: 'Word deleted successfully' };
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

  async getAllWords(id: string | undefined) {
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
}
