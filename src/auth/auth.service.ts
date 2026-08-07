import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/signup.dto';
import { UserInterface } from './interfaces/user.interface';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userservice: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  
  async register(data: RegisterDto): Promise<string> {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    const userToSave = {
      ...data,
      password: hashedPassword,
    };
    return this.userservice.create(userToSave);
  }


  async login(data: LoginDto): Promise<{ access_token: string }> {
    const user: UserInterface = await this.userservice.findByUsername(
      data.username,
    );
    if (user) {
      const isPasswordMatching = await bcrypt.compare(
        data.password,
        user.password,
      );

      if (!isPasswordMatching) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = {username: user.username, sub: user.id}
      return {
        access_token: this.jwtService.sign(payload),
      };
    }
    throw new NotFoundException();
  }
}
