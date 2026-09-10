import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateSellerDto } from './dto/create-seller.schema';
import type { UpdateSellerStatusDto } from './dto/update-seller-status.schema';
import { SELLER_REPOSITORY, SellerRecord, SellerRepository } from './seller.repository';

@Injectable()
export class SellerService {
  constructor(@Inject(SELLER_REPOSITORY) private readonly repository: SellerRepository) {}

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

  async updateStatus(id: string, dto: UpdateSellerStatusDto): Promise<SellerRecord> {
    const seller = await this.repository.findById(id);
    if (!seller) {
      throw new NotFoundException('seller not found');
    }
    if (seller.status !== 'pending') {
      throw new ConflictException(`seller status has already been decided (${seller.status})`);
    }

    return this.repository.updateStatus(id, dto.status, dto.reason ?? null);
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
