export interface ProductRecord {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  brand: string | null;
  attributes: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateProductInput {
  title: string;
  description: string;
  categoryId: string | null;
  brand: string | null;
  attributes: Record<string, unknown>;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductRepository {
  findById(id: string): Promise<ProductRecord | null>;
  search(query: string | undefined): Promise<ProductRecord[]>;
  create(input: CreateProductInput): Promise<ProductRecord>;
  findCategoryById(id: string): Promise<CategoryRecord | null>;
}
