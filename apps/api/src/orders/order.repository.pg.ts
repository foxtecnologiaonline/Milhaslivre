import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CreateOrderInput,
  OrderItemRecord,
  OrderRecord,
  OrderRepository,
  SubOrderRecord,
} from './order.repository';

function subtotalOf(items: { unitPriceCents: number; qty: number }[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.qty, 0);
}

@Injectable()
export class PgOrderRepository implements OrderRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async createOrder(input: CreateOrderInput): Promise<OrderRecord> {
    const totalCents = input.subOrders.reduce((sum, so) => sum + subtotalOf(so.items), 0);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query<{
        id: string;
        buyer_id: string;
        total_cents: number;
        status: string;
        created_at: Date;
      }>(
        `INSERT INTO orders.orders (buyer_id, total_cents)
         VALUES ($1, $2)
         RETURNING id, buyer_id, total_cents, status, created_at`,
        [input.buyerId, totalCents],
      );
      const orderRow = orderResult.rows[0];

      const subOrders: SubOrderRecord[] = [];
      for (const subOrder of input.subOrders) {
        const subtotalCents = subtotalOf(subOrder.items);

        const subOrderResult = await client.query<{
          id: string;
          order_id: string;
          seller_id: string;
          subtotal_cents: number;
          shipping_cents: number;
          status: string;
        }>(
          `INSERT INTO orders.sub_orders (order_id, seller_id, subtotal_cents)
           VALUES ($1, $2, $3)
           RETURNING id, order_id, seller_id, subtotal_cents, shipping_cents, status`,
          [orderRow.id, subOrder.sellerId, subtotalCents],
        );
        const subOrderRow = subOrderResult.rows[0];

        const items: OrderItemRecord[] = [];
        for (const item of subOrder.items) {
          const itemResult = await client.query<{
            id: string;
            sub_order_id: string;
            offer_id: string;
            qty: number;
            unit_price_cents: number;
          }>(
            `INSERT INTO orders.order_items (sub_order_id, offer_id, qty, unit_price_cents)
             VALUES ($1, $2, $3, $4)
             RETURNING id, sub_order_id, offer_id, qty, unit_price_cents`,
            [subOrderRow.id, item.offerId, item.qty, item.unitPriceCents],
          );
          const itemRow = itemResult.rows[0];
          items.push({
            id: itemRow.id,
            subOrderId: itemRow.sub_order_id,
            offerId: itemRow.offer_id,
            qty: itemRow.qty,
            unitPriceCents: itemRow.unit_price_cents,
          });
        }

        subOrders.push({
          id: subOrderRow.id,
          orderId: subOrderRow.order_id,
          sellerId: subOrderRow.seller_id,
          subtotalCents: subOrderRow.subtotal_cents,
          shippingCents: subOrderRow.shipping_cents,
          status: subOrderRow.status,
          items,
        });
      }

      await client.query('COMMIT');

      return {
        id: orderRow.id,
        buyerId: orderRow.buyer_id,
        totalCents: orderRow.total_cents,
        status: orderRow.status,
        createdAt: orderRow.created_at,
        subOrders,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
