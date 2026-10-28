import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CategoryRecord,
  CreateProductInput,
  ProductRecord,
  ProductRepository,
  SearchOptions,
} from './product.repository';

const SELECT_COLUMNS =
  'id, title, description, category_id, brand, attributes, is_blocked, created_at';

interface ProductRow {
  id: string;
  title: string;
  description: string;
  category_id: string | null;
  brand: string | null;
  attributes: Record<string, unknown>;
  is_blocked: boolean;
  created_at: Date;
}

function mapRow(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    brand: row.brand,
    attributes: row.attributes,
    isBlocked: row.is_blocked,
    createdAt: row.created_at,
  };
}

@Injectable()
export class PgProductRepository implements ProductRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<ProductRecord | null> {
    const { rows } = await this.pool.query<ProductRow>(
      `SELECT ${SELECT_COLUMNS} FROM catalog.products WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async search(query: string | undefined, options?: SearchOptions): Promise<ProductRecord[]> {
    const blockedClause = options?.includeBlocked ? '' : 'is_blocked = false AND ';
    // The admin "list all" call (includeBlocked: true) is meant to see every
    // product so there's something to unblock — capping it at 50 like the
    // public search would make products older than the 50 most recent
    // permanently unreachable from the admin panel (hidden from search once
    // blocked, and now hidden from the admin listing too).
    const limitClause = options?.includeBlocked ? '' : ' LIMIT 50';

    if (!query) {
      const { rows } = await this.pool.query<ProductRow>(
        `SELECT ${SELECT_COLUMNS} FROM catalog.products
         WHERE ${blockedClause}true ORDER BY created_at DESC${limitClause}`,
      );
      return rows.map(mapRow);
    }

    const { rows } = await this.pool.query<ProductRow>(
      `SELECT ${SELECT_COLUMNS} FROM catalog.products
       WHERE ${blockedClause}title ILIKE $1 ORDER BY created_at DESC${limitClause}`,
      [`%${query}%`],
    );
    return rows.map(mapRow);
  }

  async create(input: CreateProductInput): Promise<ProductRecord> {
    const { rows } = await this.pool.query<ProductRow>(
      `INSERT INTO catalog.products (title, description, category_id, brand, attributes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT_COLUMNS}`,
      [input.title, input.description, input.categoryId, input.brand, input.attributes],
    );
    return mapRow(rows[0]);
  }

  async findCategoryById(id: string): Promise<CategoryRecord | null> {
    const { rows } = await this.pool.query<CategoryRecord>(
      `SELECT id, name, slug FROM catalog.categories WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async setBlocked(id: string, isBlocked: boolean): Promise<ProductRecord | null> {
    const { rows } = await this.pool.query<ProductRow>(
      `UPDATE catalog.products SET is_blocked = $2 WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
      [id, isBlocked],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
}
