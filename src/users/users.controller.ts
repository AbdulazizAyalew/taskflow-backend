import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('users')
export class UsersController {
    constructor(private readonly userservice:UsersService){};

    @UseGuards(AuthGuard('jwt'))
    @Get()
    async getUsers(): Promise<string>{
        return this.userservice.getUsers();
    }

}
