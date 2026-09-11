import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { Roles } from '../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../identity/guards/roles.guard';
import { ZodValidationPipe } from '../identity/pipes/zod-validation.pipe';
import type { JwtPayload } from '../identity/types';
import { SellerService } from '../seller/seller.service';
import {
  updateSubOrderStatusSchema,
  UpdateSubOrderStatusDto,
} from './dto/update-sub-order-status.schema';
import { OrdersService } from './orders.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly sellerService: SellerService,
  ) {}

  // The buyer sees the consolidated Order; a seller only ever sees their own
  // SubOrder(s) via GET /sellers/:id/orders below — never someone else's order.
  @Get('orders/:id')
  async getOrder(@CurrentUser() user: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const order = await this.ordersService.findById(id);
    if (user.role !== 'admin' && order.buyerId !== user.sub) {
      throw new ForbiddenException("cannot view another buyer's order");
    }
    return order;
  }

  @Get('sellers/:id/orders')
  async getSellerOrders(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) sellerId: string,
  ) {
    await this.assertOwnsSeller(user, sellerId);
    return this.ordersService.findSubOrdersBySeller(sellerId);
  }

  @Patch('suborders/:id/status')
  @UseGuards(RolesGuard)
  @Roles('seller', 'admin')
  async updateSubOrderStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateSubOrderStatusSchema)) dto: UpdateSubOrderStatusDto,
  ) {
    const subOrder = await this.ordersService.findSubOrderById(id);
    await this.assertOwnsSeller(user, subOrder.sellerId);
    return this.ordersService.transitionSubOrderStatus(id, dto.status);
  }

  private async assertOwnsSeller(user: JwtPayload, sellerId: string): Promise<void> {
    if (user.role === 'admin') return;
    const seller = await this.sellerService.getApprovedSellerForUser(user.sub);
    if (seller.id !== sellerId) {
      throw new ForbiddenException("cannot access another seller's data");
    }
  }
}
