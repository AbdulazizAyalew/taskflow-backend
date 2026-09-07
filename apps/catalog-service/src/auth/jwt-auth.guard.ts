import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AUTHENTICATED_USER } from './authenticated-user';
import type { AuthenticatedContext } from './authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly strategy: JwtStrategy) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rpc = context.switchToRpc();
    const payload = rpc.getData<{ token?: unknown } | null>();
    rpc.getContext<AuthenticatedContext>()[AUTHENTICATED_USER] =
      await this.strategy.authenticate(payload?.token);
    return true;
  }
}
