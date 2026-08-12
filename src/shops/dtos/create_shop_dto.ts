import { IsString, IsNotEmpty } from "class-validator";
export class CreateShopDto{

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    location: string;

}