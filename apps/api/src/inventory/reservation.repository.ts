import type { ReservationStatus } from './types';

export interface ReservationRecord {
  id: string;
  offerId: string;
  quantity: number;
  status: ReservationStatus;
  createdAt: Date;
  releasedAt: Date | null;
}

export interface CreateReservationInput {
  offerId: string;
  quantity: number;
}

export const RESERVATION_REPOSITORY = Symbol('RESERVATION_REPOSITORY');

export interface ReservationRepository {
  create(input: CreateReservationInput): Promise<ReservationRecord>;
  findById(id: string): Promise<ReservationRecord | null>;
  markReleased(id: string): Promise<ReservationRecord>;
}
