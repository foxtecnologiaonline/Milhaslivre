export interface OrderItemInput {
  offerId: string;
  qty: number;
  unitPriceCents: number;
}

export interface SubOrderInput {
  sellerId: string;
  shippingCents: number;
  items: OrderItemInput[];
}

export interface CreateOrderInput {
  buyerId: string;
  subOrders: SubOrderInput[];
}

export interface OrderItemRecord {
  id: string;
  subOrderId: string;
  offerId: string;
  qty: number;
  unitPriceCents: number;
}

export interface SubOrderRecord {
  id: string;
  orderId: string;
  sellerId: string;
  subtotalCents: number;
  shippingCents: number;
  status: string;
  items: OrderItemRecord[];
}

export interface OrderRecord {
  id: string;
  buyerId: string;
  totalCents: number;
  status: string;
  createdAt: Date;
  subOrders: SubOrderRecord[];
}

export interface OrderItemContext {
  orderItemId: string;
  offerId: string;
  subOrderId: string;
  sellerId: string;
  buyerId: string;
  status: string;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepository {
  createOrder(input: CreateOrderInput): Promise<OrderRecord>;
  findById(id: string): Promise<OrderRecord | null>;
  findSubOrderById(id: string): Promise<SubOrderRecord | null>;
  findSubOrdersBySellerId(sellerId: string): Promise<SubOrderRecord[]>;
  findOrderItemContext(orderItemId: string): Promise<OrderItemContext | null>;
  markOrderConfirmed(id: string): Promise<void>;
  updateSubOrderStatus(id: string, status: string): Promise<SubOrderRecord>;
}
