export type Role = 'buyer' | 'seller' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Offer {
  id: string;
  productId: string;
  sellerId: string;
  priceCents: number;
  stock: number;
  condition: 'new' | 'used';
  slaDays: number;
  isBuyboxWinner: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  brand: string | null;
  attributes: Record<string, unknown>;
  createdAt: string;
}

export interface ProductWithOffers extends Product {
  offers: Offer[];
}

export interface CartItem {
  id: string;
  buyerId: string;
  offerId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  offer: Offer;
}

export interface OrderItem {
  id: string;
  subOrderId: string;
  offerId: string;
  qty: number;
  unitPriceCents: number;
}

export interface SubOrder {
  id: string;
  orderId: string;
  sellerId: string;
  subtotalCents: number;
  shippingCents: number;
  status: string;
  items: OrderItem[];
}

export interface Order {
  id: string;
  buyerId: string;
  totalCents: number;
  status: string;
  createdAt: string;
  subOrders: SubOrder[];
}

export interface Review {
  id: string;
  orderItemId: string;
  authorId: string;
  targetType: 'product' | 'seller';
  productId: string | null;
  sellerId: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface Seller {
  id: string;
  userId: string;
  companyName: string;
  document: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectedReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  recipientId: string | null;
}
