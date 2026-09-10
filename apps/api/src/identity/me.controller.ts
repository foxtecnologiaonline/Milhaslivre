import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IdentityService } from './identity.service';
import type { JwtPayload } from './types';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly identityService: IdentityService) {}

  @Get()
  async me(@CurrentUser() user: JwtPayload) {
    const found = await this.identityService.me(user.sub);
    if (!found) {
      throw new NotFoundException('user not found');
    }
    return found;
  }
}
