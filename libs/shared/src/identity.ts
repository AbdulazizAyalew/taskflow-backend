export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface PublicUser {
  id: number;
  username: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: number;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: number;
  role: UserRole;
}

export interface LaptopCreatedEvent {
  laptopId: number;
  userId: number | null;
  brand: string;
  simulateFailure?: boolean;
}
