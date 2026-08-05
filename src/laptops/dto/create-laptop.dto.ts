import { IsString, IsInt, IsPositive, IsNotEmpty, MinLength, MaxLength } from "class-validator";

export class CreateLaptopDto {
  @IsInt()
  @IsPositive()
  id: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(10,{
    message: 'Description is too short. it must be atleast 10 characters long!'
  })
  description: string;

  @IsString()
  @IsNotEmpty()
  brand: string;


  @IsInt()
  @IsPositive()
  ram: number;

  @IsInt()
  @IsPositive()
  price: number;
}