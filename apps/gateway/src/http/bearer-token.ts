import { UnauthorizedException } from '@nestjs/common';

export function bearerToken(authorization: string | undefined): string {
  const match =
    typeof authorization === 'string'
      ? /^Bearer\s+(\S+)$/i.exec(authorization.trim())
      : null;
  if (!match) throw new UnauthorizedException();
  return match[1];
}
