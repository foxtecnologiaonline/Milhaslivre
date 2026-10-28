import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CreateOrderInput,
  OrderItemContext,
  OrderItemRecord,
  OrderRecord,
  OrderRepository,
  SubOrderRecord,
} from './order.repository';

function subtotalOf(items: { unitPriceCents: number; qty: number }[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.qty, 0);
}

interface SubOrderRow {
  id: string;
  order_id: string;
  seller_id: string;
  subtotal_cents: number;
  shipping_cents: number;
  status: string;
}

@Injectable()
export class PgOrderRepository implements OrderRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async createOrder(input: CreateOrderInput): Promise<OrderRecord> {
    const totalCents = input.subOrders.reduce(
      (sum, so) => sum + subtotalOf(so.items) + so.shippingCents,
      0,
    );

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

        const subOrderResult = await client.query<SubOrderRow>(
          `INSERT INTO orders.sub_orders (order_id, seller_id, subtotal_cents, shipping_cents)
           VALUES ($1, $2, $3, $4)
           RETURNING id, order_id, seller_id, subtotal_cents, shipping_cents, status`,
          [orderRow.id, subOrder.sellerId, subtotalCents, subOrder.shippingCents],
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

  async findById(id: string): Promise<OrderRecord | null> {
    const orderResult = await this.pool.query<{
      id: string;
      buyer_id: string;
      total_cents: number;
      status: string;
      created_at: Date;
    }>(`SELECT id, buyer_id, total_cents, status, created_at FROM orders.orders WHERE id = $1`, [id]);
    const orderRow = orderResult.rows[0];
    if (!orderRow) return null;

    const rows = await this.pool.query<{
      sub_order_id: string;
      seller_id: string;
      subtotal_cents: number;
      shipping_cents: number;
      sub_order_status: string;
      item_id: string | null;
      offer_id: string | null;
      qty: number | null;
      unit_price_cents: number | null;
    }>(
      `SELECT
         so.id AS sub_order_id, so.seller_id, so.subtotal_cents, so.shipping_cents, so.status AS sub_order_status,
         oi.id AS item_id, oi.offer_id, oi.qty, oi.unit_price_cents
       FROM orders.sub_orders so
       LEFT JOIN orders.order_items oi ON oi.sub_order_id = so.id
       WHERE so.order_id = $1
       ORDER BY so.created_at ASC, oi.id ASC`,
      [id],
    );

    const subOrdersById = new Map<string, SubOrderRecord>();
    for (const row of rows.rows) {
      let subOrder = subOrdersById.get(row.sub_order_id);
      if (!subOrder) {
        subOrder = {
          id: row.sub_order_id,
          orderId: id,
          sellerId: row.seller_id,
          subtotalCents: row.subtotal_cents,
          shippingCents: row.shipping_cents,
          status: row.sub_order_status,
          items: [],
        };
        subOrdersById.set(row.sub_order_id, subOrder);
      }
      if (row.item_id) {
        subOrder.items.push({
          id: row.item_id,
          subOrderId: row.sub_order_id,
          offerId: row.offer_id as string,
          qty: row.qty as number,
          unitPriceCents: row.unit_price_cents as number,
        });
      }
    }

    return {
      id: orderRow.id,
      buyerId: orderRow.buyer_id,
      totalCents: orderRow.total_cents,
      status: orderRow.status,
      createdAt: orderRow.created_at,
      subOrders: Array.from(subOrdersById.values()),
    };
  }

  async findSubOrderById(id: string): Promise<SubOrderRecord | null> {
    const subOrderResult = await this.pool.query<SubOrderRow>(
      `SELECT id, order_id, seller_id, subtotal_cents, shipping_cents, status
       FROM orders.sub_orders WHERE id = $1`,
      [id],
    );
    const subOrderRow = subOrderResult.rows[0];
    if (!subOrderRow) return null;

    const itemRows = await this.pool.query<{
      id: string;
      sub_order_id: string;
      offer_id: string;
      qty: number;
      unit_price_cents: number;
    }>(
      `SELECT id, sub_order_id, offer_id, qty, unit_price_cents
       FROM orders.order_items WHERE sub_order_id = $1`,
      [id],
    );

    return {
      id: subOrderRow.id,
      orderId: subOrderRow.order_id,
      sellerId: subOrderRow.seller_id,
      subtotalCents: subOrderRow.subtotal_cents,
      shippingCents: subOrderRow.shipping_cents,
      status: subOrderRow.status,
      items: itemRows.rows.map((row) => ({
        id: row.id,
        subOrderId: row.sub_order_id,
        offerId: row.offer_id,
        qty: row.qty,
        unitPriceCents: row.unit_price_cents,
      })),
    };
  }

  async findSubOrdersBySellerId(sellerId: string): Promise<SubOrderRecord[]> {
    const rows = await this.pool.query<{
      sub_order_id: string;
      order_id: string;
      subtotal_cents: number;
      shipping_cents: number;
      sub_order_status: string;
      item_id: string | null;
      offer_id: string | null;
      qty: number | null;
      unit_price_cents: number | null;
    }>(
      `SELECT
         so.id AS sub_order_id, so.order_id, so.subtotal_cents, so.shipping_cents, so.status AS sub_order_status,
         oi.id AS item_id, oi.offer_id, oi.qty, oi.unit_price_cents
       FROM orders.sub_orders so
       LEFT JOIN orders.order_items oi ON oi.sub_order_id = so.id
       WHERE so.seller_id = $1
       ORDER BY so.created_at DESC, oi.id ASC`,
      [sellerId],
    );

    const subOrdersById = new Map<string, SubOrderRecord>();
    for (const row of rows.rows) {
      let subOrder = subOrdersById.get(row.sub_order_id);
      if (!subOrder) {
        subOrder = {
          id: row.sub_order_id,
          orderId: row.order_id,
          sellerId,
          subtotalCents: row.subtotal_cents,
          shippingCents: row.shipping_cents,
          status: row.sub_order_status,
          items: [],
        };
        subOrdersById.set(row.sub_order_id, subOrder);
      }
      if (row.item_id) {
        subOrder.items.push({
          id: row.item_id,
          subOrderId: row.sub_order_id,
          offerId: row.offer_id as string,
          qty: row.qty as number,
          unitPriceCents: row.unit_price_cents as number,
        });
      }
    }

    return Array.from(subOrdersById.values());
  }

  async findOrderItemContext(orderItemId: string): Promise<OrderItemContext | null> {
    const { rows } = await this.pool.query<{
      offer_id: string;
      sub_order_id: string;
      seller_id: string;
      status: string;
      buyer_id: string;
    }>(
      `SELECT oi.offer_id, oi.sub_order_id, so.seller_id, so.status, o.buyer_id
       FROM orders.order_items oi
       JOIN orders.sub_orders so ON so.id = oi.sub_order_id
       JOIN orders.orders o ON o.id = so.order_id
       WHERE oi.id = $1`,
      [orderItemId],
    );
    const row = rows[0];
    if (!row) return null;

    return {
      orderItemId,
      offerId: row.offer_id,
      subOrderId: row.sub_order_id,
      sellerId: row.seller_id,
      buyerId: row.buyer_id,
      status: row.status,
    };
  }

  async markOrderConfirmed(id: string): Promise<void> {
    await this.pool.query(`UPDATE orders.orders SET status = 'confirmed' WHERE id = $1`, [id]);
  }

  async updateSubOrderStatus(id: string, status: string): Promise<SubOrderRecord> {
    await this.pool.query(`UPDATE orders.sub_orders SET status = $2 WHERE id = $1`, [id, status]);
    const subOrder = await this.findSubOrderById(id);
    if (!subOrder) {
      throw new Error(`sub-order ${id} disappeared after status update`);
    }
    return subOrder;
  }
}
