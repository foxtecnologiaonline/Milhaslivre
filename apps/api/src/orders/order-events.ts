export const SUB_ORDER_STATUS_CHANGED = 'sub_order.status_changed';

export interface SubOrderStatusChangedEvent {
  subOrderId: string;
  orderId: string;
  sellerId: string;
  from: string;
  to: string;
}
