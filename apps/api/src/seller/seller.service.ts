import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PagarmeService } from '../pagarme/pagarme.service';
import type { CreateSellerDto } from './dto/create-seller.schema';
import type { UpdateSellerStatusDto } from './dto/update-seller-status.schema';
import { SELLER_REPOSITORY, SellerRecord, SellerRepository } from './seller.repository';

@Injectable()
export class SellerService {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly repository: SellerRepository,
    private readonly pagarmeService: PagarmeService,
  ) {}

  async onboard(userId: string, dto: CreateSellerDto): Promise<SellerRecord> {
    const existing = await this.repository.findByUserId(userId);
    if (existing) {
      throw new ConflictException('seller profile already exists for this user');
    }

    return this.repository.create({
      userId,
      companyName: dto.companyName,
      document: dto.document,
    });
  }

  async findById(id: string): Promise<SellerRecord> {
    const seller = await this.repository.findById(id);
    if (!seller) {
      throw new NotFoundException('seller not found');
    }
    return seller;
  }

  // Lets the seller panel resolve "my seller profile" without knowing the id
  // up front (and regardless of approval status — unlike getApprovedSellerForUser).
  async findMine(userId: string): Promise<SellerRecord> {
    const seller = await this.repository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundException('no seller profile for this user yet');
    }
    return seller;
  }

  async updateStatus(id: string, dto: UpdateSellerStatusDto): Promise<SellerRecord> {
    const seller = await this.repository.findById(id);
    if (!seller) {
      throw new NotFoundException('seller not found');
    }
    if (seller.status !== 'pending') {
      throw new ConflictException(`seller status has already been decided (${seller.status})`);
    }

    const updated = await this.repository.updateStatus(id, dto.status, dto.reason ?? null);
    if (dto.status !== 'approved') {
      return updated;
    }

    // Pagar.me split needs a recipient_id per seller; register it now that
    // they're approved. No-ops (returns null) when PAGARME_API_KEY is unset.
    const recipientId = await this.pagarmeService.createRecipient({
      name: updated.companyName,
      document: updated.document,
    });
    return recipientId ? this.repository.attachRecipient(id, recipientId) : updated;
  }

  // Exposed for other modules (e.g. catalog) to resolve a seller without reading seller.* directly.
  async getApprovedSellerForUser(userId: string): Promise<SellerRecord> {
    const seller = await this.repository.findByUserId(userId);
    if (!seller || seller.status !== 'approved') {
      throw new ForbiddenException('seller is not approved to sell yet');
    }
    return seller;
  }
}
