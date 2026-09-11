import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '@app/shared';
import type { PublicUser } from '@app/shared';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(username: string, password: string): Promise<PublicUser> {
    const user = await this.users.save(
      this.users.create({
        username,
        password,
        role: UserRole.USER,
      }),
    );
    return { id: user.id, username: user.username, role: user.role };
  }

  findForLogin(username: string): Promise<User | null> {
    return this.users.findOne({
      where: { username },
      select: { id: true, username: true, password: true, role: true },
    });
  }

  findAll(): Promise<PublicUser[]> {
    return this.users.find({
      select: { id: true, username: true, role: true },
    });
  }
}
