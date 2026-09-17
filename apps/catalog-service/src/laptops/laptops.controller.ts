import { Controller, UseGuards } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LaptopsService } from './laptops.service';
import {
  CreateLaptopMessage,
  DeleteLaptopMessage,
  LaptopIdDto,
  ListLaptopsDto,
  UpdateLaptopMessage,
} from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '@app/shared';

@Controller()
export class LaptopsController {
  constructor(private readonly laptops: LaptopsService) {}

  @MessagePattern('catalog.laptops.findAll')
  findAll(@Payload() query: ListLaptopsDto) {
    return this.laptops.findAll(query);
  }

  @MessagePattern('catalog.laptops.findOne')
  findOne(@Payload() data: LaptopIdDto) {
    return this.laptops.findOne(data.id);
  }

  @UseGuards(JwtAuthGuard)
  @MessagePattern('catalog.laptops.create')
  create(
    @Payload() data: CreateLaptopMessage,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.laptops.create(data.laptop, user);
  }

  @UseGuards(JwtAuthGuard)
  @MessagePattern('catalog.laptops.update')
  update(
    @Payload() data: UpdateLaptopMessage,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.laptops.update(data.id, data.laptop, user);
  }

  @UseGuards(JwtAuthGuard)
  @MessagePattern('catalog.laptops.delete')
  remove(
    @Payload() data: DeleteLaptopMessage,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.laptops.remove(data.id, user);
  }
}
