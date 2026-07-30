import { Test, TestingModule } from '@nestjs/testing';
import { LaptopsController } from './laptops.controller';

describe('LaptopsController', () => {
  let controller: LaptopsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaptopsController],
    }).compile();

    controller = module.get<LaptopsController>(LaptopsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
