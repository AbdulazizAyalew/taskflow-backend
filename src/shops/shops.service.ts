import { Injectable , NotFoundException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from './shop.entitiy';
import { CreateShopDto } from './dtos/create_shop_dto';
import { Laptop } from 'src/laptops/Laptop.entity';


@Injectable()
export class ShopsService {

    constructor(
        @InjectRepository(Shop)
        private shoprepository: Repository<Shop>,

        @InjectRepository(Laptop)
        private laptoprepository: Repository<Laptop>
    ){};



    async getShops(): Promise<Shop[]>{
        const shops = await this.shoprepository.find({
            relations: {laptops: true},
        });

        if (shops.length === 0) {
          throw new NotFoundException(`No Shop Found!`);
        }
        return shops;
    }



    async createShops(newshop: CreateShopDto): Promise<string>{
        const new_shop = await this.shoprepository.create(newshop);
        await this.shoprepository.save(new_shop);
        return `New Shop has been Created Successfully!`;
    }



    async addLaptopsToShop(shopId:number,laptopId:number): Promise<Shop>{
        const shop = await this.shoprepository.findOne({
            where:{id:shopId},
            relations:{
                laptops:true,
            },
        });
        
        if (!shop){
            throw new NotFoundException(`shop with Id: ${shopId} not Found`);
        }
        const laptop = await this.laptoprepository.findOne({
            where: {id:laptopId},
        })

        if (!laptop){
            throw new NotFoundException(`Laptop with ID: ${laptopId} not Found!`);
        }
        shop.laptops.push(laptop);
        return await this.shoprepository.save(shop);
    }


    async getShopsByLaptopId(laptopId:number): Promise<Shop[]>{
        const shops = await this.shoprepository.find({
          where: {
            laptops: { id: laptopId },
          },
        });

       if (shops.length === 0) {
         throw new NotFoundException(
           `No shops found selling laptop with ID: ${laptopId}`,
         );
       }

       return shops;
    }
}
