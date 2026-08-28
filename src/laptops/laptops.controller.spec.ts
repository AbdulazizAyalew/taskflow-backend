import { Test, TestingModule } from '@nestjs/testing';
import { LaptopsController } from './laptops.controller';
import { LaptopsService } from './laptops.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';


const mockLaptopsService = {
  loadLaptops: jest.fn(),
  loadlaptopById: jest.fn(),
  createLaptop: jest.fn(),
  updateLaptopById: jest.fn(),
  deleteLaptopById: jest.fn(),
};

describe('LaptopsController', () => {
  let controller: LaptopsController;

  beforeEach(async () => {
    jest.clearAllMocks(); 

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaptopsController],
      providers: [
        {
          provide: LaptopsService,
          useValue: mockLaptopsService,
        },
      ],
    })

      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<LaptopsController>(LaptopsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLaptops', () => {
    it('should return an array of laptops', async () => {
      const expectedLaptops = [
        { id: 1022, description: 'Lenovo Legion', model: "Lenovo",ram: 32, price: 150000 },
      ];
      mockLaptopsService.loadLaptops.mockResolvedValue(expectedLaptops);

      const result = await controller.getLaptops();

      expect(result).toEqual(expectedLaptops);
      expect(mockLaptopsService.loadLaptops).toHaveBeenCalledTimes(1);
    });
  });



  describe('getLaptopsById', () => {
    it('should return a laptop on success', async () => {
      const expectedLaptop = {
        id: 1022,
        description: "LENOVO",
        model: "Lenovo",
        ram: 32,
        price: 10000,
      };

      mockLaptopsService.loadlaptopById.mockResolvedValue(expectedLaptop);


      const result = await controller.getLaptopById(1022);

      expect(result).toEqual(expectedLaptop);
      expect(mockLaptopsService.loadlaptopById).toHaveBeenCalledWith(1022);
      expect(mockLaptopsService.loadlaptopById).toHaveBeenCalledTimes(1);
    });
  });
  

  describe('createLaptop', () => {
    it('should return the created laptop object on success', async () => {

      const newLaptop = {
        description: "Pavilion",
        brand: "HP",
        ram: 16,
        price: 102000
      };

      const expectedresult = {
        id: 1,
        description: "Pavilion",
        brand: "HP",
        ram: 16,
        price: 102000,
        userId: 1
      };


      const mockReq = { 
  user: { userId: 1, username: "tester1" } 
};

      mockLaptopsService.createLaptop.mockResolvedValue(expectedresult);

      const result = await controller.createLaptop(newLaptop,mockReq);

      expect(result).toEqual(expectedresult);
      expect(mockLaptopsService.createLaptop).toHaveBeenCalledWith(newLaptop,mockReq.user);
      expect(mockLaptopsService.createLaptop).toHaveBeenCalledTimes(1); 

    });
  });


  describe('updateLaptopById', () => {
    it('should return the updated data on success', async () => {
      const updateData = {
      brand: "HP",
    };

    const expectedresult = {
      id: 1,
      description: "HP",
      brand: "HP",
      ram: 16,
      price: 20000,
      userId: 1,
    };


    const mockReq = { 
  user: { userId: 1, username: "tester1" } 
};

    mockLaptopsService.updateLaptopById.mockResolvedValue(expectedresult)

    const result = await controller.updateLaptopById(1,updateData, mockReq);

    expect(result).toEqual(expectedresult);
    expect(mockLaptopsService.updateLaptopById).toHaveBeenCalledWith(1,updateData,mockReq.user);
    expect(mockLaptopsService.updateLaptopById).toHaveBeenCalledTimes(1);

    });
  });



  describe('deleteLaptopsById', () => {
    it('should return the deleted laptop object on success', async () => {
      const mockReq = { 
      user: { userId: 1, username: "tester1" } 
    };

    const expectedresult = {
      id: 1,
      description: "HP",
      brand: "HP",
      ram: 32,
      price: 20000,
    };

    mockLaptopsService.deleteLaptopById.mockResolvedValue(expectedresult);

    const result = await controller.deleteLaptopById(1, mockReq);

    expect(result).toEqual(expectedresult);
    expect(mockLaptopsService.deleteLaptopById).toHaveBeenCalledWith(1,mockReq.user);
    expect(mockLaptopsService.deleteLaptopById).toHaveBeenCalledTimes(1);
    })
  })
});