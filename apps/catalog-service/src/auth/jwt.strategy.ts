import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@app/shared';
import type { AuthenticatedUser, JwtPayload } from '@app/shared';

@Injectable()
export class JwtStrategy {
  constructor(private readonly jwt: JwtService) {}

  async authenticate(token: unknown): Promise<AuthenticatedUser> {
    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('A valid token is required');
    }
    try {
      const claims = await this.jwt.verifyAsync<Partial<JwtPayload>>(token);
      if (
        !Number.isInteger(claims.sub) ||
        claims.sub! <= 0 ||
        !Number.isFinite(claims.exp) ||
        !Object.values(UserRole).includes(claims.role!)
      )
        throw new Error('Invalid claims');
      return { userId: claims.sub!, role: claims.role! };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
