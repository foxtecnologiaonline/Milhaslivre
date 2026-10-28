export type Role = 'buyer' | 'seller' | 'admin';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
