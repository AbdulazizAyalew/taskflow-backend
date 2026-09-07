import type { RmqContext } from '@nestjs/microservices';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface AuthenticatedUser {
  userId: number;
  role: UserRole;
}

// Identity is attached to the server-side context, never trusted from the payload.
export const AUTHENTICATED_USER = Symbol('authenticated-user');
export type AuthenticatedContext = RmqContext & {
  [AUTHENTICATED_USER]?: AuthenticatedUser;
};
