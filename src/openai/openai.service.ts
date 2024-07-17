import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  constructor(private config: ConfigService) {}

  private openai = new OpenAI({
    apiKey: this.config.get('OPENAI_API_KEY'),
  });

  async translate(systemPrompt: string, userPrompt: any) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: JSON.stringify(userPrompt),
          },
        ],
        temperature: 0.7,
        max_tokens: 64,
        top_p: 1,
      });

      let result: any;
      try {
        result = JSON.parse(response.choices[0].message.content);
      } catch (jsonError) {
        return {
          error: 'Word translation failed. We apologize for the error.',
          details: jsonError.message,
        };
      }

      return result;
    } catch (error) {
      throw error;
    }
  }
}
