import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ){}

  async create(userData: any) {
    const newUser = this.userRepository.create(userData);

    return await this.userRepository.save(newUser);
  }

  async findByUsername(username: string) {
    return await this.userRepository.findOne({
      where: {username}
    });
  }

  async getUsers(){
    return this.userRepository.find();
  }
}
