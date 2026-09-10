import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { Roles } from '../identity/decorators/roles.decorator';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { RolesGuard } from '../identity/guards/roles.guard';
import { ZodValidationPipe } from '../identity/pipes/zod-validation.pipe';
import type { JwtPayload } from '../identity/types';
import { releaseStockSchema, ReleaseStockDto } from './dto/release-stock.schema';
import { reserveStockSchema, ReserveStockDto } from './dto/reserve-stock.schema';
import { updateStockSchema, UpdateStockDto } from './dto/update-stock.schema';
import { InventoryService } from './inventory.service';

@Controller('offers')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post(':id/reserve')
  reserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(reserveStockSchema)) dto: ReserveStockDto,
  ) {
    return this.inventoryService.reserve(id, dto.quantity);
  }

  @Post(':id/release')
  release(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(releaseStockSchema)) dto: ReleaseStockDto,
  ) {
    return this.inventoryService.release(id, dto.reservationId);
  }

  @Patch(':id/stock')
  @UseGuards(RolesGuard)
  @Roles('seller', 'admin')
  updateStock(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateStockSchema)) dto: UpdateStockDto,
  ) {
    return this.inventoryService.updateStock(user, id, dto.stock);
  }
}
