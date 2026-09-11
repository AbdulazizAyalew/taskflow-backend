import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RpcService } from '../rpc/rpc.service';
import { bearerToken } from '../http/bearer-token';
import {
  CreateLaptopDto,
  UpdateLaptopDto,
  ListLaptopsDto,
  LaptopIdDto,
} from '@app/shared';

@Controller('laptops')
export class LaptopsController {
  constructor(private readonly rpc: RpcService) {}

  @Get()
  findAll(@Query() query: ListLaptopsDto) {
    return this.rpc.catalogRequest('catalog.laptops.findAll', query);
  }

  @Get(':id')
  findOne(@Param() params: LaptopIdDto) {
    return this.rpc.catalogRequest('catalog.laptops.findOne', params);
  }

  @Post()
  create(
    @Body() laptop: CreateLaptopDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.rpc.catalogRequest('catalog.laptops.create', {
      token: bearerToken(authorization),
      laptop,
    });
  }

  @Patch(':id')
  update(
    @Param() params: LaptopIdDto,
    @Body() laptop: UpdateLaptopDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.rpc.catalogRequest('catalog.laptops.update', {
      token: bearerToken(authorization),
      id: params.id,
      laptop,
    });
  }

  @Delete(':id')
  remove(
    @Param() params: LaptopIdDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.rpc.catalogRequest('catalog.laptops.delete', {
      token: bearerToken(authorization),
      id: params.id,
    });
  }
}
