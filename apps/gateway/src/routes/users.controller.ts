import { Controller, Get, Headers } from '@nestjs/common';
import { RpcService } from '../rpc/rpc.service';
import { bearerToken } from '../http/bearer-token';

@Controller('users')
export class UsersController {
  constructor(private readonly rpc: RpcService) {}

  @Get()
  findAll(@Headers('authorization') authorization?: string) {
    return this.rpc.user('user.findAll', { token: bearerToken(authorization) });
  }
}
