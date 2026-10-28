export type ShipmentStatus = 'label_generated' | 'in_transit' | 'delivered' | 'failed';

export interface ShipmentRecord {
  id: string;
  subOrderId: string;
  carrier: string | null;
  trackingCode: string | null;
  status: ShipmentStatus;
  priceCents: number;
  etaDays: number | null;
  createdAt: Date;
}

export interface CreateShipmentInput {
  subOrderId: string;
  carrier: string | null;
  trackingCode: string | null;
  status: ShipmentStatus;
  priceCents: number;
  etaDays: number | null;
}

export const SHIPMENT_REPOSITORY = Symbol('SHIPMENT_REPOSITORY');

export interface ShipmentRepository {
  findById(id: string): Promise<ShipmentRecord | null>;
  findBySubOrderId(subOrderId: string): Promise<ShipmentRecord | null>;
  create(input: CreateShipmentInput): Promise<ShipmentRecord>;
}
