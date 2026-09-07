import { IsOptional, IsString, IsNotEmpty, IsInt, MinLength, IsPositive, IsIn } from "class-validator";

export class updateLaptopDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'Description is too short. it must be atleast 10 characters long!',
  })
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  brand?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  ram?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  price?: number;
}