import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import type { CreateOfferInput, OfferRecord, OfferRepository } from '../catalog/offer.repository';
import type {
  CategoryRecord,
  ProductRecord,
  ProductRepository,
} from '../catalog/product.repository';
import type { JwtPayload } from '../identity/types';
import type { SellerRecord } from '../seller/seller.repository';
import type { SellerService } from '../seller/seller.service';
import { InventoryService } from './inventory.service';
import type {
  CreateReservationInput,
  ReservationRecord,
  ReservationRepository,
} from './reservation.repository';

class NullProductRepository implements ProductRepository {
  async findById(): Promise<ProductRecord | null> {
    return null;
  }
  async search(): Promise<ProductRecord[]> {
    return [];
  }
  async create(): Promise<ProductRecord> {
    throw new Error('not used in inventory tests');
  }
  async findCategoryById(): Promise<CategoryRecord | null> {
    return null;
  }
}

class InMemoryOfferRepository implements OfferRepository {
  offers: OfferRecord[] = [];

  seed(overrides: Partial<OfferRecord> = {}): OfferRecord {
    const offer: OfferRecord = {
      id: 'offer-1',
      productId: 'product-1',
      sellerId: 'seller-1',
      priceCents: 1000,
      stock: 10,
      condition: 'new',
      slaDays: 3,
      isBuyboxWinner: false,
      createdAt: new Date(),
      ...overrides,
    };
    this.offers.push(offer);
    return offer;
  }

  async create(input: CreateOfferInput): Promise<OfferRecord> {
    return this.seed(input);
  }

  async findByProductId(productId: string) {
    return this.offers.filter((o) => o.productId === productId);
  }

  async findById(id: string) {
    return this.offers.find((o) => o.id === id) ?? null;
  }

  async decrementStock(id: string, quantity: number) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer || offer.stock < quantity) return null;
    offer.stock -= quantity;
    return offer;
  }

  async incrementStock(id: string, quantity: number) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer) return null;
    offer.stock += quantity;
    return offer;
  }

  async setStock(id: string, quantity: number) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer) return null;
    offer.stock = quantity;
    return offer;
  }
}

class InMemoryReservationRepository implements ReservationRepository {
  reservations: ReservationRecord[] = [];
  private counter = 0;

  async create(input: CreateReservationInput): Promise<ReservationRecord> {
    const reservation: ReservationRecord = {
      id: `reservation-${++this.counter}`,
      status: 'active',
      createdAt: new Date(),
      releasedAt: null,
      ...input,
    };
    this.reservations.push(reservation);
    return reservation;
  }

  async findById(id: string) {
    return this.reservations.find((r) => r.id === id) ?? null;
  }

  async markReleased(id: string): Promise<ReservationRecord> {
    const reservation = this.reservations.find((r) => r.id === id);
    if (!reservation) throw new Error('not found');
    reservation.status = 'released';
    reservation.releasedAt = new Date();
    return reservation;
  }
}

const approvedSeller: SellerRecord = {
  id: 'seller-1',
  userId: 'user-1',
  companyName: 'Loja da Ana',
  document: '12345678900',
  status: 'approved',
  rejectedReason: null,
  createdAt: new Date(),
  approvedAt: new Date(),
  recipientId: null,
};

function buildService(sellerOverrides?: Partial<SellerService>) {
  const offerRepository = new InMemoryOfferRepository();
  const sellerService = {
    getApprovedSellerForUser: jest.fn().mockResolvedValue(approvedSeller),
    ...sellerOverrides,
  } as unknown as SellerService;
  const catalogService = new CatalogService(new NullProductRepository(), offerRepository, sellerService);
  const reservationRepository = new InMemoryReservationRepository();
  const inventoryService = new InventoryService(reservationRepository, catalogService, sellerService);

  return { inventoryService, offerRepository, reservationRepository, sellerService };
}

describe('InventoryService', () => {
  describe('reserve', () => {
    it('decrements stock and records the reservation on the happy path', async () => {
      const { inventoryService, offerRepository } = buildService();
      const offer = offerRepository.seed({ stock: 10 });

      const reservation = await inventoryService.reserve(offer.id, 3);

      expect(reservation).toMatchObject({ offerId: offer.id, quantity: 3, status: 'active' });
      expect((await offerRepository.findById(offer.id))?.stock).toBe(7);
    });

    it('rejects a reservation that exceeds available stock', async () => {
      const { inventoryService, offerRepository } = buildService();
      const offer = offerRepository.seed({ stock: 2 });

      await expect(inventoryService.reserve(offer.id, 5)).rejects.toBeInstanceOf(ConflictException);
      expect((await offerRepository.findById(offer.id))?.stock).toBe(2);
    });
  });

  describe('release', () => {
    it('returns stock to the offer and marks the reservation released on the happy path', async () => {
      const { inventoryService, offerRepository } = buildService();
      const offer = offerRepository.seed({ stock: 10 });
      const reservation = await inventoryService.reserve(offer.id, 4);

      const released = await inventoryService.release(offer.id, reservation.id);

      expect(released.status).toBe('released');
      expect((await offerRepository.findById(offer.id))?.stock).toBe(10);
    });

    it('rejects releasing the same reservation twice', async () => {
      const { inventoryService, offerRepository } = buildService();
      const offer = offerRepository.seed({ stock: 10 });
      const reservation = await inventoryService.reserve(offer.id, 4);
      await inventoryService.release(offer.id, reservation.id);

      await expect(inventoryService.release(offer.id, reservation.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('updateStock', () => {
    const adminUser: JwtPayload = { sub: 'admin-1', email: 'admin@example.com', role: 'admin' };
    const sellerUser: JwtPayload = { sub: 'user-1', email: 'seller@example.com', role: 'seller' };

    it('lets an admin set stock regardless of the offer owner on the happy path', async () => {
      const { inventoryService, offerRepository } = buildService();
      const offer = offerRepository.seed({ sellerId: 'someone-else' });

      const updated = await inventoryService.updateStock(adminUser, offer.id, 42);

      expect(updated.stock).toBe(42);
    });

    it('lets the owning seller set stock on the happy path', async () => {
      const { inventoryService, offerRepository } = buildService();
      const offer = offerRepository.seed({ sellerId: approvedSeller.id });

      const updated = await inventoryService.updateStock(sellerUser, offer.id, 20);

      expect(updated.stock).toBe(20);
    });

    it("rejects a seller updating another seller's offer", async () => {
      const { inventoryService, offerRepository } = buildService();
      const offer = offerRepository.seed({ sellerId: 'someone-else' });

      await expect(inventoryService.updateStock(sellerUser, offer.id, 20)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws when the offer does not exist', async () => {
      const { inventoryService } = buildService();

      await expect(inventoryService.updateStock(sellerUser, 'missing', 20)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
