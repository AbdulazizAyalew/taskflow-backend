import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RpcService } from '../rpc/rpc.service';
import { LoginDto, RegisterDto } from '@app/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly rpc: RpcService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.rpc.user('user.register', body);
  }

  // Preserve the existing code's six-second window (the old README said a minute).
  @Throttle({ default: { limit: 3, ttl: 6000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.rpc.user('user.login', body);
  }
}
