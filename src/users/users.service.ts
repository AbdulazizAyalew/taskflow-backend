import { Injectable } from '@nestjs/common';
import { RegisterDto } from 'src/auth/dto/signup.dto';

@Injectable()
export class UsersService {
  private readonly users: any = [];

  async create(userData: any) {
    const newUser = { id: Date.now(), ...userData };
    this.users.push(newUser);
    return newUser;
  }

  async findByUsername(username: string) {
    return this.users.find((user) => user.username === username);
  }

  async getUsers(){
    return this.users;
  }
}
