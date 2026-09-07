import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Shop } from './shop.entity';
import { Laptop } from '../laptops/laptop.entity';
import { CreateShopMessage } from './dto/shop-messages.dto';

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(Laptop) private readonly laptops: Repository<Laptop>,
    private readonly dataSource: DataSource,
    @InjectQueue('notifications') private readonly notifications: Queue,
  ) {}

  async findAll() {
    const shops = await this.shops.find({ relations: { laptops: true } });
    if (!shops.length) throw new NotFoundException('No Shop Found!');
    return shops;
  }

  async create(data: CreateShopMessage) {
    try {
      await this.dataSource.transaction(async (manager) => {
        // Shop creation was public in the monolith, so these have no owner.
        const laptop = await manager.save(
          Laptop,
          manager.create(Laptop, { ...data.laptop, userId: null }),
        );
        await manager.save(
          Shop,
          manager.create(Shop, {
            ...data.shop,
            userId: null,
            laptops: [laptop],
          }),
        );
      });
      return 'New Shop and initial Laptop have been created successfully!';
    } catch {
      throw new InternalServerErrorException(
        'Transaction failed! Both Shop and Laptop were rolled back.',
      );
    }
  }

  async addLaptop(shopId: number, laptopId: number) {
    const shop = await this.shops.findOne({
      where: { id: shopId },
      relations: { laptops: true },
    });
    if (!shop) throw new NotFoundException(`shop with Id: ${shopId} not Found`);
    const laptop = await this.laptops.findOneBy({ id: laptopId });
    if (!laptop)
      throw new NotFoundException(`Laptop with ID: ${laptopId} not Found!`);
    if (shop.laptops.some((item) => item.id === laptopId)) return shop;
    shop.laptops.push(laptop);
    const saved = await this.shops.save(shop);
    // As before, enqueue follows the DB write; an outbox is outside this milestone.
    await this.notifications.add('laptop-linked', {
      shopId: saved.id,
      laptopId: laptop.id,
      timestamp: new Date().toISOString(),
    });
    return saved;
  }

  async findByLaptop(laptopId: number) {
    const shops = await this.shops.find({
      where: { laptops: { id: laptopId } },
      relations: { laptops: true },
    });
    if (!shops.length)
      throw new NotFoundException(
        `No shops found selling laptop with ID: ${laptopId}`,
      );
    return shops;
  }
}
