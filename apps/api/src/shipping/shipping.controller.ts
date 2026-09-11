import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { Roles } from '../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../identity/guards/roles.guard';
import { ZodValidationPipe } from '../identity/pipes/zod-validation.pipe';
import type { JwtPayload } from '../identity/types';
import { labelSchema, LabelDto } from './dto/label.schema';
import { quoteSchema, QuoteDto } from './dto/quote.schema';
import { ShippingService } from './shipping.service';

@Controller('shipping')
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('quote')
  quote(@Body(new ZodValidationPipe(quoteSchema)) dto: QuoteDto) {
    return this.shippingService.quote(dto);
  }

  @Post('label')
  @UseGuards(RolesGuard)
  @Roles('seller', 'admin')
  label(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(labelSchema)) dto: LabelDto) {
    return this.shippingService.requestLabel(user, dto.subOrderId);
  }

  @Get(':id/tracking')
  tracking(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.shippingService.getTracking(id);
  }
}
