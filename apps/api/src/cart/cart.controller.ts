import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { Roles } from '../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../identity/guards/roles.guard';
import { ZodValidationPipe } from '../identity/pipes/zod-validation.pipe';
import type { JwtPayload } from '../identity/types';
import { CartService } from './cart.service';
import { addCartItemSchema, AddCartItemDto } from './dto/add-cart-item.schema';

@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('buyer')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('items')
  addItem(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(addCartItemSchema)) dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(user.sub, dto);
  }

  @Get()
  getCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.getCart(user.sub);
  }

  @Delete('items/:id')
  @HttpCode(204)
  async removeItem(@CurrentUser() user: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.cartService.removeItem(user.sub, id);
  }
}
