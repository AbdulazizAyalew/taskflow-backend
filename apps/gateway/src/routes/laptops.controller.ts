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
import type { LaptopDetails, LaptopWithOwner, OwnerSummary } from '@app/shared';
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
  async findOne(@Param() params: LaptopIdDto): Promise<LaptopWithOwner> {
    const laptop = await this.rpc.catalogRequest<LaptopDetails>(
      'catalog.laptops.findOne',
      params,
    );
    if (laptop.userId === null) {
      return {
        ...laptop,
        owner: null,
        partial: false,
        ownerStatus: 'unassigned',
      };
    }
    try {
      const owner = await this.rpc.user<OwnerSummary | null>('user.findOwner', {
        id: laptop.userId,
      });
      return {
        ...laptop,
        owner,
        partial: owner === null,
        ownerStatus: owner ? 'available' : 'not_found',
      };
    } catch {
      return {
        ...laptop,
        owner: null,
        partial: true,
        ownerStatus: 'unavailable',
      };
    }
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
