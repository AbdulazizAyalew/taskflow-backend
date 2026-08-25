import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { User } from './user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard,RolesGuard)
export class UsersController {

    constructor(private readonly userservice:UsersService){};

    @Roles(UserRole.ADMIN)
    @Get()
    async getUsers(): Promise<User[]>{
        return this.userservice.getUsers();
    }

}
