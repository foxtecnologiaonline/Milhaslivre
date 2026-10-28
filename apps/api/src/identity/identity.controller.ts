import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { loginSchema, LoginDto } from './dto/login.schema';
import { refreshSchema, RefreshDto } from './dto/refresh.schema';
import { registerSchema, RegisterDto } from './dto/register.schema';
import { IdentityService } from './identity.service';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto) {
    return this.identityService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.identityService.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto) {
    return this.identityService.refresh(dto);
  }
}
