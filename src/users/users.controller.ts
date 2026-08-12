import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
    constructor(private readonly userservice:UsersService){};

    @UseGuards(AuthGuard('jwt'))
    @Get()
    async getUsers(): Promise<User[]>{
        return this.userservice.getUsers();
    }

}
