import { Body, Controller } from '@nestjs/common';
import { Post } from '@nestjs/common';
import { RegisterDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';


@Controller('auth')
export class AuthController {

    constructor(private readonly authservice: AuthService){}

    @Post('login')
    async login(@Body() logindto: LoginDto){
        return this.authservice.login(logindto);
    }

    @Post('register')
    public register(@Body() registerdto: RegisterDto){
        return this.authservice.register(registerdto);
    }

}
