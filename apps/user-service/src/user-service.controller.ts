import { Controller, UseGuards } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth/auth.service';
import { LoginDto } from '@app/shared';
import { RegisterDto } from '@app/shared';
import { AdminJwtGuard } from './auth/admin-jwt.guard';
import { UsersService } from './users/users.service';

@Controller()
export class UserServiceController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @MessagePattern('user.register')
  register(@Payload() data: RegisterDto) {
    return this.authService.register(data);
  }

  @MessagePattern('user.login')
  login(@Payload() data: LoginDto) {
    return this.authService.login(data);
  }

  @UseGuards(AdminJwtGuard)
  @MessagePattern('user.findAll')
  findAll() {
    return this.usersService.findAll();
  }
}
