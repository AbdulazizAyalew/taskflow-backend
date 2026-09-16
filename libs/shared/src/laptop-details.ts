import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class UserIdDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id: number;
}

export interface OwnerSummary {
  id: number;
  username: string;
}

export interface LaptopDetails {
  id: number;
  userId: number | null;
  description: string;
  brand: string;
  ram: number;
  price: number;
}

export interface LaptopWithOwner extends LaptopDetails {
  owner: OwnerSummary | null;
  partial: boolean;
  ownerStatus: 'available' | 'unassigned' | 'not_found' | 'unavailable';
}
