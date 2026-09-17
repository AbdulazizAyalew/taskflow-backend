import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@app/shared';
import type { JwtPayload } from '@app/shared';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const data = context.switchToRpc().getData<{ token?: unknown } | null>();
    if (typeof data?.token !== 'string' || !data.token) {
      throw new UnauthorizedException('A valid token is required');
    }

    let claims: Partial<JwtPayload>;
    try {
      claims = await this.jwt.verifyAsync(data.token);
      if (
        !Number.isInteger(claims.sub) ||
        claims.sub! <= 0 ||
        !Number.isFinite(claims.exp)
      ) {
        throw new Error('Invalid claims');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (claims.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
    return true;
  }
}
