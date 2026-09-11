import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { Roles } from '../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../identity/guards/roles.guard';
import { ZodValidationPipe } from '../identity/pipes/zod-validation.pipe';
import type { JwtPayload } from '../identity/types';
import { createSellerSchema, CreateSellerDto } from './dto/create-seller.schema';
import {
  updateSellerStatusSchema,
  UpdateSellerStatusDto,
} from './dto/update-seller-status.schema';
import { SellerService } from './seller.service';
import type { SellerStatus } from './types';

const VALID_STATUSES: SellerStatus[] = ['pending', 'approved', 'rejected'];

@Controller('sellers')
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  onboard(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createSellerSchema)) dto: CreateSellerDto,
  ) {
    return this.sellerService.onboard(user.sub, dto);
  }

  // Admin-only browse (e.g. the pending-approval queue) — the buyer-facing
  // GET /sellers/:id below only ever exposes a single already-known seller.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  list(@Query('status') status?: string) {
    if (status !== undefined && !VALID_STATUSES.includes(status as SellerStatus)) {
      throw new BadRequestException(`invalid status: ${status}`);
    }
    return this.sellerService.list(status as SellerStatus | undefined);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.sellerService.findMine(user.sub);
  }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sellerService.findById(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateSellerStatusSchema)) dto: UpdateSellerStatusDto,
  ) {
    return this.sellerService.updateStatus(id, dto);
  }
}
