import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateLaptopDto } from './laptop.dto';

export class CreateShopDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  location: string;
}

export class CreateShopMessage {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateShopDto)
  shop: CreateShopDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateLaptopDto)
  laptop: CreateLaptopDto;
}

export class ShopLaptopMessage {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  shopId: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  laptopId: number;
}

export class ShopsByLaptopMessage {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  laptopId: number;
}
