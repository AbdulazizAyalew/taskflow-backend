import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { Laptop } from './laptop.entity';
import { LaptopCache } from './laptop-cache.service';
import {
  CreateLaptopDto,
  ListLaptopsDto,
  UpdateLaptopDto,
} from './dto/laptop-messages.dto';
import { UserRole } from '../auth/authenticated-user';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import {
  CATALOG_EVENTS_CLIENT,
  LAPTOP_CREATED_EVENT,
} from '../events/catalog-events.constants';

@Injectable()
export class LaptopsService {
  private readonly logger = new Logger(LaptopsService.name);

  constructor(
    @InjectRepository(Laptop) private readonly laptops: Repository<Laptop>,
    private readonly cache: LaptopCache,
    @Inject(CATALOG_EVENTS_CLIENT) private readonly events: ClientProxy,
  ) {}

  async findAll(query: ListLaptopsDto) {
    if (
      query.minPrice != null &&
      query.maxPrice != null &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice must not exceed maxPrice');
    }
    return this.cache.remember(query, async () => {
      const where: FindOptionsWhere<Laptop> = {};
      if (query.brand) where.brand = query.brand;
      if (query.minPrice != null && query.maxPrice != null) {
        where.price = Between(query.minPrice, query.maxPrice);
      } else if (query.minPrice != null) {
        where.price = MoreThanOrEqual(query.minPrice);
      } else if (query.maxPrice != null) {
        where.price = LessThanOrEqual(query.maxPrice);
      }
      const [items, total] = await this.laptops.findAndCount({
        where,
        order: { [query.sort]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      return {
        items,
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          lastPage: Math.ceil(total / query.limit),
        },
      };
    });
  }

  async findOne(id: number) {
    const laptop = await this.laptops.findOneBy({ id });
    if (!laptop)
      throw new NotFoundException(`Laptop with ID: ${id} Not Found!`);
    return laptop;
  }

  async create(data: CreateLaptopDto, user: AuthenticatedUser) {
    const laptop = await this.laptops.save(
      this.laptops.create({ ...data, userId: user.userId }),
    );
    this.events
      .emit(LAPTOP_CREATED_EVENT, {
        laptopId: laptop.id,
        userId: laptop.userId,
        brand: laptop.brand,
      })
      .subscribe({
        error: (error: unknown) =>
          this.logger.error('Could not emit laptop_created event', error),
      });
    return laptop;
  }

  async update(id: number, data: UpdateLaptopDto, user: AuthenticatedUser) {
    const laptop = await this.findOne(id);
    // Agreed behavior: even admins may only update their own laptops.
    if (laptop.userId !== user.userId)
      throw new ForbiddenException('You can only edit your own laptops');
    Object.assign(laptop, data);
    return this.laptops.save(laptop);
  }

  async remove(id: number, user: AuthenticatedUser) {
    const laptop = await this.findOne(id);
    if (laptop.userId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete you own Laptops');
    }
    return this.laptops.remove(laptop);
  }
}
