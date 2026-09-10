import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import type {
  CategoryRecord,
  CreateProductInput,
  ProductRecord,
  ProductRepository,
} from './product.repository';

interface ProductRow {
  id: string;
  title: string;
  description: string;
  category_id: string | null;
  brand: string | null;
  attributes: Record<string, unknown>;
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
    createdAt: row.created_at,
  };
}

@Injectable()
export class PgProductRepository implements ProductRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findById(id: string): Promise<ProductRecord | null> {
    const { rows } = await this.pool.query<ProductRow>(
      `SELECT id, title, description, category_id, brand, attributes, created_at
       FROM catalog.products WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async search(query: string | undefined): Promise<ProductRecord[]> {
    if (!query) {
      const { rows } = await this.pool.query<ProductRow>(
        `SELECT id, title, description, category_id, brand, attributes, created_at
         FROM catalog.products ORDER BY created_at DESC LIMIT 50`,
      );
      return rows.map(mapRow);
    }

    const { rows } = await this.pool.query<ProductRow>(
      `SELECT id, title, description, category_id, brand, attributes, created_at
       FROM catalog.products WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 50`,
      [`%${query}%`],
    );
    return rows.map(mapRow);
  }

  async create(input: CreateProductInput): Promise<ProductRecord> {
    const { rows } = await this.pool.query<ProductRow>(
      `INSERT INTO catalog.products (title, description, category_id, brand, attributes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, category_id, brand, attributes, created_at`,
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
}
