import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import type { OfferRecord } from '../catalog/offer.repository';
import { SellerService } from '../seller/seller.service';
import type { JwtPayload } from '../identity/types';
import {
  RESERVATION_REPOSITORY,
  ReservationRecord,
  ReservationRepository,
} from './reservation.repository';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    private readonly catalogService: CatalogService,
    private readonly sellerService: SellerService,
  ) {}

  async reserve(offerId: string, quantity: number): Promise<ReservationRecord> {
    await this.catalogService.reserveOfferStock(offerId, quantity);
    return this.reservations.create({ offerId, quantity });
  }

  async release(offerId: string, reservationId: string): Promise<ReservationRecord> {
    const reservation = await this.reservations.findById(reservationId);
    if (!reservation || reservation.offerId !== offerId) {
      throw new NotFoundException('reservation not found');
    }
    if (reservation.status !== 'active') {
      throw new ConflictException('reservation is not active');
    }

    await this.catalogService.releaseOfferStock(offerId, reservation.quantity);
    return this.reservations.markReleased(reservationId);
  }

  async updateStock(user: JwtPayload, offerId: string, stock: number): Promise<OfferRecord> {
    if (user.role !== 'admin') {
      const seller = await this.sellerService.getApprovedSellerForUser(user.sub);
      const offer = await this.catalogService.getOfferById(offerId);
      if (offer.sellerId !== seller.id) {
        throw new ForbiddenException("cannot manage another seller's offer");
      }
    }

    return this.catalogService.setOfferStock(offerId, stock);
  }
}
