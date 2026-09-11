import type { RmqContext } from '@nestjs/microservices';

import type { AuthenticatedUser } from '@app/shared';

// Identity is attached to the server-side context, never trusted from the payload.
export const AUTHENTICATED_USER = Symbol('authenticated-user');
export type AuthenticatedContext = RmqContext & {
  [AUTHENTICATED_USER]?: AuthenticatedUser;
};
