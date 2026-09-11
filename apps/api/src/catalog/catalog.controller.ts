import {
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
import { CatalogService } from './catalog.service';
import { createOfferSchema, CreateOfferDto } from './dto/create-offer.schema';
import { createProductSchema, CreateProductDto } from './dto/create-product.schema';
import {
  setProductModerationSchema,
  SetProductModerationDto,
} from './dto/set-product-moderation.schema';

@Controller('products')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  createProduct(@Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto) {
    return this.catalogService.createProduct(dto);
  }

  @Get()
  search(@Query('query') query?: string) {
    return this.catalogService.searchProducts(query);
  }

  // Admin-only listing that, unlike the search above, includes blocked
  // products — needed so the admin panel can find something to unblock.
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listAllForAdmin() {
    return this.catalogService.listAllProductsForAdmin();
  }

  @Patch(':id/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setModeration(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(setProductModerationSchema)) dto: SetProductModerationDto,
  ) {
    return this.catalogService.setProductBlocked(id, dto.isBlocked);
  }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.findProductById(id);
  }

  @Post(':id/offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  createOffer(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Body(new ZodValidationPipe(createOfferSchema)) dto: CreateOfferDto,
  ) {
    return this.catalogService.createOffer(user.sub, productId, dto);
  }
}
