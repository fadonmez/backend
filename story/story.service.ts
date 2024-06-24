import { ForbiddenException, Injectable } from '@nestjs/common';
import { OpenAiService } from 'src/openai/openai.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WordService } from 'src/word/word.service';
import { CreateStoryDto, StoryTranslateWordDto } from './dto';
import { Request } from 'express';

@Injectable()
export class StoryService {
  constructor(
    private prisma: PrismaService,
    private openAiService: OpenAiService,
    private wordService: WordService,
  ) {}

  async getAllStories(languageCode: string): Promise<any> {
    try {
      return await this.prisma.story.findMany({
        where: {
          languageCode: languageCode,
        },
        select: {
          id: true,
          title: true,
          languageCode: true,
          storyLevel: true,
          imageUrl: true,
        },
      });
    } catch (error) {
      return null;
    }
  }

  async getStoryById(id: string): Promise<any> {
    try {
      return await this.prisma.story.findUnique({
        where: {
          id: id,
        },
      });
    } catch (error) {
      return null;
    }
  }

  async translateWord(
    storyTranslateWordDto: StoryTranslateWordDto,
    req: Request,
  ): Promise<any> {
    const decodedUserInfo = req.user as { id: string; email: string };
    if (storyTranslateWordDto.userId !== decodedUserInfo.id) {
      throw new ForbiddenException();
    }
    try {
      const userPrompt = {
        wordName: storyTranslateWordDto.wordName.toLowerCase(),
        targetLang: storyTranslateWordDto.languageCode.toLowerCase(),
        nativeLang: storyTranslateWordDto.nativeLang.toLowerCase(),
      };

      const systemPrompt = `You are a translation tool. You receive three inputs from the user: "wordName" for the name of the word, "targetLang" for the language of the word and "nativeLang" for the translation language. You will translate ${userPrompt.wordName} from ${userPrompt.targetLang} to ${userPrompt.nativeLang}. Return error if "wordName" contains extra characters. And you will give a sample sentence of up to 12 words in ${userPrompt.targetLang} containing the word. Before translating, you will determine in which language "wordName" is a word. If everything is OK, it returns {"translation": (translatedWord), "example": (example), "wordLanguage": (determinedLanguageCode), "wordLevel": (levelOfTheWord. Only A1,A2,B1,B2,C1,C2)}. If any other problem occurs, it returns "error": "Something went wrong".`;

      const isWordInDatabase = await this.wordService.getWordByName(
        storyTranslateWordDto.wordName,
        storyTranslateWordDto.languageCode,
      );
      if (isWordInDatabase) {
        const translationValue = isWordInDatabase.translations.find(
          (translation) =>
            translation.languageCode === storyTranslateWordDto.nativeLang,
        );

        if (!translationValue) {
          const translatedWord = await this.openAiService.translate(
            systemPrompt,
            userPrompt,
          );

          await this.prisma.word.update({
            where: { id: isWordInDatabase.id },
            data: {
              translations: {
                create: {
                  languageCode: storyTranslateWordDto.nativeLang,
                  translationValue: translatedWord.translation
                    .toLowerCase()
                    .trim(),
                },
              },
            },
          });

          return {
            translationValue: translatedWord.translation,
            languageCode: translatedWord.wordLanguage,
          };
        }

        return translationValue;
      }

      const translatedWord = await this.openAiService.translate(
        systemPrompt,
        userPrompt,
      );

      if (translatedWord.error)
        throw new ForbiddenException(translatedWord.error);
      await this.prisma.word.create({
        data: {
          languageCode: storyTranslateWordDto.languageCode,
          wordName: storyTranslateWordDto.wordName.toLowerCase().trim(),
          wordLevel: translatedWord.wordLevel.toUpperCase(),
          example: translatedWord.example, // Açıklamanızda sağlanan örneğe dayanarak
          translations: {
            create: [
              {
                languageCode: storyTranslateWordDto.nativeLang,
                translationValue: translatedWord.translation
                  .toLowerCase()
                  .trim(),
              },
            ],
          },
        },
      });

      // UPDATE STORY WORDS

      return {
        translationValue: translatedWord.translation,
        languageCode: translatedWord.wordLanguage,
      };
    } catch (error) {
      console.log(error);
    }
  }

  async createStory(
    createStoryDto: CreateStoryDto,
    req: Request,
  ): Promise<any> {
    const decodedUserInfo = req.user as { id: string; email: string };
    if (createStoryDto.userId !== decodedUserInfo.id) {
      throw new ForbiddenException();
    }
    try {
      return await this.prisma.story.create({
        data: {
          title: createStoryDto.title,
          content: createStoryDto.content,
          languageCode: createStoryDto.languageCode,
          storyLevel: createStoryDto.storyLevel,
          imageUrl: createStoryDto.imageUrl,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }
}
