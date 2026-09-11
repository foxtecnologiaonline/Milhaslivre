import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PagarmeService } from '../pagarme/pagarme.service';
import { SellerService } from './seller.service';
import type { CreateSellerInput, SellerRecord, SellerRepository } from './seller.repository';
import type { SellerStatus } from './types';

class InMemorySellerRepository implements SellerRepository {
  private sellers: SellerRecord[] = [];
  private counter = 0;

  async findById(id: string) {
    return this.sellers.find((s) => s.id === id) ?? null;
  }

  async findByUserId(userId: string) {
    return this.sellers.find((s) => s.userId === userId) ?? null;
  }

  async create(input: CreateSellerInput) {
    const seller: SellerRecord = {
      id: `seller-${++this.counter}`,
      userId: input.userId,
      companyName: input.companyName,
      document: input.document,
      status: 'pending',
      rejectedReason: null,
      createdAt: new Date(),
      approvedAt: null,
      recipientId: null,
    };
    this.sellers.push(seller);
    return seller;
  }

  async updateStatus(id: string, status: SellerStatus, rejectedReason: string | null) {
    const seller = this.sellers.find((s) => s.id === id);
    if (!seller) throw new Error('not found');
    seller.status = status;
    seller.rejectedReason = rejectedReason;
    seller.approvedAt = status === 'approved' ? new Date() : seller.approvedAt;
    return seller;
  }

  async attachRecipient(id: string, recipientId: string) {
    const seller = this.sellers.find((s) => s.id === id);
    if (!seller) throw new Error('not found');
    seller.recipientId = recipientId;
    return seller;
  }
}

const baseDto = { companyName: 'Loja da Ana', document: '12345678900' };

function buildService(pagarmeOverrides?: Partial<PagarmeService>) {
  const pagarmeService = {
    createRecipient: jest.fn().mockResolvedValue(null),
    ...pagarmeOverrides,
  } as unknown as PagarmeService;

  return new SellerService(new InMemorySellerRepository(), pagarmeService);
}

describe('SellerService', () => {
  describe('onboard', () => {
    it('creates a pending seller profile on the happy path', async () => {
      const service = buildService();

      const seller = await service.onboard('user-1', baseDto);

      expect(seller).toMatchObject({ userId: 'user-1', status: 'pending' });
    });

    it('rejects a second onboarding for the same user', async () => {
      const service = buildService();
      await service.onboard('user-1', baseDto);

      await expect(service.onboard('user-1', baseDto)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findById', () => {
    it('returns the seller on the happy path', async () => {
      const service = buildService();
      const created = await service.onboard('user-1', baseDto);

      const found = await service.findById(created.id);

      expect(found.id).toBe(created.id);
    });

    it('throws when the seller does not exist', async () => {
      const service = buildService();

      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('approves a pending seller on the happy path', async () => {
      const service = buildService();
      const created = await service.onboard('user-1', baseDto);

      const updated = await service.updateStatus(created.id, { status: 'approved' });

      expect(updated.status).toBe('approved');
      expect(updated.approvedAt).toBeInstanceOf(Date);
    });

    it('registers a Pagar.me recipient when approved and the gateway is configured', async () => {
      const service = buildService({ createRecipient: jest.fn().mockResolvedValue('rp_123') });
      const created = await service.onboard('user-1', baseDto);

      const updated = await service.updateStatus(created.id, { status: 'approved' });

      expect(updated.recipientId).toBe('rp_123');
    });

    it('leaves recipientId null when Pagar.me is not configured (no-op)', async () => {
      const service = buildService();
      const created = await service.onboard('user-1', baseDto);

      const updated = await service.updateStatus(created.id, { status: 'approved' });

      expect(updated.recipientId).toBeNull();
    });

    it('rejects updating the status of a seller that already has a decision', async () => {
      const service = buildService();
      const created = await service.onboard('user-1', baseDto);
      await service.updateStatus(created.id, { status: 'approved' });

      await expect(service.updateStatus(created.id, { status: 'rejected', reason: 'x' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws when the seller does not exist', async () => {
      const service = buildService();

      await expect(service.updateStatus('missing', { status: 'approved' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
