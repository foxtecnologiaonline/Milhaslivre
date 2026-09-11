import type { SellerStatus } from './types';

export interface SellerRecord {
  id: string;
  userId: string;
  companyName: string;
  document: string;
  status: SellerStatus;
  rejectedReason: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  recipientId: string | null;
}

export interface CreateSellerInput {
  userId: string;
  companyName: string;
  document: string;
}

export const SELLER_REPOSITORY = Symbol('SELLER_REPOSITORY');

export interface SellerRepository {
  findById(id: string): Promise<SellerRecord | null>;
  findByUserId(userId: string): Promise<SellerRecord | null>;
  create(input: CreateSellerInput): Promise<SellerRecord>;
  updateStatus(
    id: string,
    status: SellerStatus,
    rejectedReason: string | null,
  ): Promise<SellerRecord>;
  attachRecipient(id: string, recipientId: string): Promise<SellerRecord>;
}
