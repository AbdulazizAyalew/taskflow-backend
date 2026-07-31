import { Test, TestingModule } from '@nestjs/testing';
import { LaptopsController } from './laptops.controller';
import { LaptopsService } from './laptops.service';

describe('LaptopsController', () => {
  let controller: LaptopsController;
  let service: LaptopsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaptopsController],
      providers: [LaptopsService],
    }).compile();

    controller = module.get<LaptopsController>(LaptopsController);
    service = module.get<LaptopsService>(LaptopsService);
  });

  it('should return mock Laptop data', async () => {

    const fakeFiledata = [
      {
        id: 1022,
        description: 'A brand new Lenovo Laptop',
        brand: 'Lenovo Yoga',
        ram: 16,
        price: 125000,
      },
      {
        id: 1023,
        description: 'A brand new HP Laptop',
        brand: 'HP Elitebook',
        ram: 16,
        price: 52000,
      },
      {
        id: 1024,
        description: 'A brand new Macbook M5 PRO Laptop',
        brand: 'Macbook M5 Pro 24GB Unified Memory',
        ram: 16,
        price: 550000,
      },
    ];
    jest.spyOn(service, 'loadLaptops').mockResolvedValue(fakeFiledata);
    
    const result = await controller.getLaptops();

    expect(result).toEqual(fakeFiledata);
  });
});


