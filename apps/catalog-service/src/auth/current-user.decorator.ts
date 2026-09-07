import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AUTHENTICATED_USER } from './authenticated-user';
import type { AuthenticatedContext } from './authenticated-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const user = context.switchToRpc().getContext<AuthenticatedContext>()[
      AUTHENTICATED_USER
    ];
    if (!user) throw new UnauthorizedException('A valid token is required');
    return user;
  },
);
