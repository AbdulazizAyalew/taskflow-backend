import { Injectable , NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Shop } from './shop.entitiy';
import { CreateShopDto } from './dtos/create_shop_dto';
import { CreateLaptopDto } from 'src/laptops/dto/create-laptop.dto';
import { Laptop } from 'src/laptops/Laptop.entity';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';


@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop)
    private shoprepository: Repository<Shop>,

    @InjectRepository(Laptop)
    private laptoprepository: Repository<Laptop>,

    private dataSource: DataSource,

    @InjectQueue('notifications')
    private notificationsQueue: Queue,
  ) {}

  async getShops(): Promise<Shop[]> {
    const shops = await this.shoprepository.find({
      relations: { laptops: true },
    });

    if (shops.length === 0) {
      throw new NotFoundException(`No Shop Found!`);
    }
    return shops;
  }

  // I added newLaptop to the parameters so you can pass in the initial laptop data!
  async createShop(
    newShop: CreateShopDto,
    newLaptop: CreateLaptopDto,
  ): Promise<string> {

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    await queryRunner.startTransaction();

    try {

      const laptopInstance = queryRunner.manager.create(Laptop, newLaptop);
      const savedLaptop = await queryRunner.manager.save(laptopInstance);


      const shopInstance = queryRunner.manager.create(Shop, newShop);
      shopInstance.laptops = [savedLaptop]; 

      await queryRunner.manager.save(shopInstance);


      await queryRunner.commitTransaction();

      return `New Shop and initial Laptop have been created successfully!`;
    } catch (error) {

      await queryRunner.rollbackTransaction();

      throw new InternalServerErrorException(
        'Transaction failed! Both Shop and Laptop were rolled back.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async addLaptopsToShop(shopId: number, laptopId: number): Promise<Shop> {
    const shop = await this.shoprepository.findOne({
      where: { id: shopId },
      relations: {
        laptops: true,
      },
    });

    if (!shop) {
      throw new NotFoundException(`shop with Id: ${shopId} not Found`);
    }
    const laptop = await this.laptoprepository.findOne({
      where: { id: laptopId },
    });

    if (!laptop) {
      throw new NotFoundException(`Laptop with ID: ${laptopId} not Found!`);
    }
    shop.laptops.push(laptop);
    const savedShop = await this.shoprepository.save(shop);

    await this.notificationsQueue.add('laptop-linked', {
      shopId: savedShop.id,
      laptopId: laptop.id,
      timestamp: new Date().toISOString(),
    });

    return savedShop;
  }

  async getShopsByLaptopId(laptopId: number): Promise<Shop[]> {
    const shops = await this.shoprepository.find({
      where: {
        laptops: { id: laptopId },
      },
      relations: {laptops:true},
    });

    if (shops.length === 0) {
      throw new NotFoundException(
        `No shops found selling laptop with ID: ${laptopId}`,
      );
    }

    return shops;
  }
}
