import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendService } from 'nestjs-resend';
import { TokenService } from '../token/token.service';

@Injectable()
export class EmailService {
  constructor(
    private readonly resendService: ResendService,
    private tokenService: TokenService,
    private config: ConfigService,
  ) {}

  async sendMail(email: string, name: string, password: string) {
    const verificationToken = await this.tokenService.createToken(
      email,
      name,
      password,
    );
    console.log(verificationToken);

    await this.resendService.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Confirm your email',
      html: `<p> Your code is ${verificationToken.token}. If it's not you simply ignore.</p>`,
    });
  }
}
