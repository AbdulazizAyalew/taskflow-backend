import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(data: RegisterDto) {
    return this.users.create(
      data.username,
      await bcrypt.hash(data.password, 10),
    );
  }

  async login(data: LoginDto): Promise<{ access_token: string }> {
    const user = await this.users.findForLogin(data.username);
    // Preserve the original login status codes during migration.
    if (!user) throw new NotFoundException();
    if (!(await bcrypt.compare(data.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      access_token: await this.jwt.signAsync({
        sub: user.id,
        username: user.username,
        role: user.role,
      }),
    };
  }
}
