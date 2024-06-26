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

      const result: any = JSON.parse(
        response.choices[0].message.content as any,
      );

      return result;
    } catch (error) {
      console.log(error);
    }
  }
}
