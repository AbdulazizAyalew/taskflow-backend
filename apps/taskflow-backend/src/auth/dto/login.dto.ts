import { IsString, Min, MinLength } from "class-validator";
export class LoginDto {
    @IsString()
    @MinLength(4,{
        message: 'Username Must be atleast 4 characters Long'
    })
    username: string;

    @IsString()
    @MinLength(8,{
        message: 'Password Must be atleast 8 characters Long'
    })
    password: string;
}