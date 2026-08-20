import { Body, Controller } from '@nestjs/common';
import { Post } from '@nestjs/common';
import { RegisterDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';


@Controller('auth')
export class AuthController {

    constructor(private readonly authservice: AuthService){}

    @Throttle({default: {limit: 3, ttl: 6000}})
    @Post('login')
    async login(@Body() logindto: LoginDto){
        return this.authservice.login(logindto);
    }

    @Post('register')
    public register(@Body() registerdto: RegisterDto){
        return this.authservice.register(registerdto);
    }

}
