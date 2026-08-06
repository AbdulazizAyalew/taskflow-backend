import { Controller } from '@nestjs/common';
import { Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly userservice:UsersService){};

    @Get()
    async getUsers(): Promise<string>{
        return this.userservice.getUsers();
    }

}
