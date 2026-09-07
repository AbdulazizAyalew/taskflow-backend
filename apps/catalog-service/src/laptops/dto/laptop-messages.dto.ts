import { Type, Transform } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateLaptopDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'Description is too short. it must be atleast 10 characters long!',
  })
  description: string;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  ram: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  price: number;
}

export class UpdateLaptopDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'Description is too short. it must be atleast 10 characters long!',
  })
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  brand?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  ram?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  price?: number;
}

export class ListLaptopsDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit = 10;

  @IsIn(['id', 'description', 'brand', 'ram', 'price', 'userId'])
  sort: 'id' | 'description' | 'brand' | 'ram' | 'price' | 'userId' = 'id';

  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'ASC';

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;
}

export class LaptopIdDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id: number;
}

export class CreateLaptopMessage {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateLaptopDto)
  laptop: CreateLaptopDto;
}

export class UpdateLaptopMessage extends LaptopIdDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateLaptopDto)
  laptop: UpdateLaptopDto;
}

export class DeleteLaptopMessage extends LaptopIdDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
