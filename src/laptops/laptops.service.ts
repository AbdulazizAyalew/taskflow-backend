import { ForbiddenException, Injectable,NotFoundException } from '@nestjs/common';
import { LaptopInterface } from './interfaces/Laptops.interface';
import { CreateLaptopDto } from './dto/create-laptop.dto';
import { updateLaptopDto } from './dto/update-laptop.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, FindOptionsWhere  } from 'typeorm';
import { Laptop } from './Laptop.entity';
import { UserRole } from 'src/common/enums/user-role.enum';

@Injectable()
export class LaptopsService {

  constructor(
    @InjectRepository(Laptop)
    private laptopRepository: Repository<Laptop>,
  ) {}

  
  async loadLaptops(query: any = {}): Promise<any> {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    const skip = (page - 1) * limit;

    const sort = query.sort || 'id';
    const order = query.order && query.order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const where: FindOptionsWhere<Laptop> = {};

    if (query.brand) {
      where.brand = query.brand;
    }

    if (query.minPrice && query.maxPrice) {
      where.price = Between(parseInt(query.minPrice, 10), parseInt(query.maxPrice, 10));
    } else if (query.minPrice) {
      where.price = MoreThanOrEqual(parseInt(query.minPrice, 10));
    } else if (query.maxPrice) {
      where.price = LessThanOrEqual(parseInt(query.maxPrice, 10));
    }


    const [data, total] = await this.laptopRepository.findAndCount({
      where,
      order: { [sort]: order },
      skip,
      take: limit,
    });

    return {
      items: data,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      }
    };
  }


  async loadlaptopById(id): Promise<LaptopInterface> {
    const laptop = await this.laptopRepository.findOne({
      where: { id },
    });
    if (laptop) {
      return laptop;
    }
    throw new NotFoundException(`Laptop with ID: ${id} Not Found!`);
  }


  async createLaptop(newLaptop: CreateLaptopDto, user:any): Promise<Laptop> {
    const newlapt = await this.laptopRepository.create({
      ...newLaptop,
      userId: user.userId,
    });

    return await this.laptopRepository.save(newlapt);
  }


  async updateLaptopById(
    id: number,
    updatedLaptop: updateLaptopDto,
    user: any,
  ): Promise<Laptop> {

    const laptop = await this.laptopRepository.findOne({
      where: { id },
    });

    if (!laptop) {
      throw new NotFoundException(`Laptop with id ${id} not found`);
    }

    if (laptop.userId !== user.userId){
      throw new ForbiddenException('You can only edit your own laptops')
    }
    // To merge the incoming updated data with the existing laptop data
    Object.assign(laptop, updatedLaptop);

    return await this.laptopRepository.save(laptop);
  }


  async deleteLaptopById(id: number, user: any): Promise<Laptop> {
    const laptop = await this.laptopRepository.findOne({
      where: {id}
    })

    if (!laptop){
      throw new NotFoundException(`Laptop with ${id} not found`);
    }

    if (laptop.userId != user.userId) {
      if (user.role !== UserRole.ADMIN){
        throw new ForbiddenException('You can only delete you own Laptops');
      }
      
    }
    return await this.laptopRepository.remove(laptop);
    
  }

}
