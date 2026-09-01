import { Test,TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { LaptopsService } from "./laptops.service";
import { Laptop } from "./Laptop.entity";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

const mockLaptopRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findAndCount: jest.fn(),
  remove: jest.fn(),
};


describe('LaptopsService' ,()=> {
  let service: LaptopsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module : TestingModule = await Test.createTestingModule({
      providers: [
        LaptopsService,
        {
          provide: getRepositoryToken(Laptop),
          useValue: mockLaptopRepository,
        },
      ],
    }).compile();

    service = module.get<LaptopsService>(LaptopsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });



  describe('loadLaptops', () => {
    it('Should return a paginated object of Laptops', async () => {
      const expectedLaptops = [
        {
            "id": 1022,
            "description": "A brand new Lenovo Laptop",
            "brand": "Lenovo Legion",
            "ram": 32,
            "price": 150000
        },
        {
            "id": 1023,
            "description": "A brand new HP Laptop",
            "brand": "HP PAVILION",
            "ram": 16,
            "price": 110000
        },
      ];

      mockLaptopRepository.findAndCount.mockResolvedValue([expectedLaptops, 2]);

      const result = await service.loadLaptops();

      expect(result).toEqual({
        items: expectedLaptops,
        meta: {
          total: 2,
          page: 1,
          limit: 10,
          lastPage: 1
        }
      });
      expect(mockLaptopRepository.findAndCount).toHaveBeenCalledTimes(1);
    });
  });



  describe('loadlaptopbyId', () => {

    it('should throw a NotFoundException if the laptop does not exist', async () => {
      mockLaptopRepository.findOne.mockResolvedValue(null);

      await expect(service.loadlaptopById(9999))
        .rejects.toThrow(NotFoundException);
    });

    it('should return a laptop if the Id exist', async () => {

      const expectedresult = {
          "id":1022,
          "description":"Hp Laptop",
          "ram":16,
          "price":30000
        }

      mockLaptopRepository.findOne.mockResolvedValue(expectedresult);

      const result = await service.loadlaptopById(1022);

      expect(result).toEqual(expectedresult);
      expect(mockLaptopRepository.findOne).toHaveBeenCalledTimes(1);
      expect(mockLaptopRepository.findOne).toHaveBeenCalledWith({
        where: {id:1022}
      })

    });
  })


  describe('createlaptop', () => {
    it('should return the laptop object on success', async () => {
      const newlaptopdto = {
        "description":"Hp Laptop",
        "brand":"HP",
        "ram":32,
        "price":400000
      };

      const mockUser = {
        userId: 1,
        username: "testuser"
      };

      const expectedresult = {
        id: 1022,
        ...newlaptopdto,
        userId: mockUser.userId
      };


      mockLaptopRepository.create.mockReturnValue(expectedresult);
      mockLaptopRepository.save.mockResolvedValue(expectedresult);    

      const result = await service.createLaptop(newlaptopdto,mockUser);

      expect(result).toEqual(expectedresult);
      expect(mockLaptopRepository.create).toHaveBeenCalledWith({
        ...newlaptopdto,
        userId: mockUser.userId,
      });
      expect(mockLaptopRepository.save).toHaveBeenCalledWith(expectedresult);
    });
  });




  describe('updateLaptopById', () => {
    it('should throw a ForbiddenException if the user does not own the laptop', async () => {
      const updatedata = { description: "HP Pavilion" };
      const mockUser = { userId: 1 };

      const mockLaptopdata = {    
          id: 1022,
          description: "Hp Laptop",
          brand: "HP",
          ram: 16,
          price: 3000,
          userId: 2 // Different Id from the mock user Id
      };

      mockLaptopRepository.findOne.mockResolvedValue(mockLaptopdata);

      await expect(service.updateLaptopById(1022, updatedata, mockUser))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw Not Found Exception if the laptop doesnt exist',async () => {
      const updatedata = {
        description:"HP",
      };

      const mockUser = {
        userId:1
      };
      const laptopdata = null;

      mockLaptopRepository.findOne.mockResolvedValue(laptopdata);

      await expect(service.updateLaptopById(1022,updatedata,mockUser))
      .rejects.toThrow(NotFoundException)
    });


    it('should return the updated laptop object on success', async () => {
      const updatedata = {
        description: "HP Pavilion",
      }
      const mockUser = {
        userId: 1,
        username: "tester1",
      }

      const mockLaptopdata = {    
          id: 1022,
          description:"Hp Laptop",
          brand: "HP",
          ram:16,
          price:3000,
          userId: 1
      }

      const expectedresult = {
        id: 1022,
        description:"HP Pavilion",
        brand: "HP",
        ram:16,
        price:3000,
        userId: 1
      }

      mockLaptopRepository.findOne.mockResolvedValue(mockLaptopdata);
      mockLaptopRepository.save.mockResolvedValue(expectedresult);

      const result = await service.updateLaptopById(1022,updatedata,mockUser);

      expect(result).toEqual(expectedresult);
      expect(mockLaptopRepository.findOne).toHaveBeenCalledTimes(1);
      expect(mockLaptopRepository.save).toHaveBeenCalledWith(expectedresult);

    });
  });



  describe('deleteLaptopById', () => {
    it('should throw Not Found Exception if the laptop doesnt exist',async () => {
      const mockUser = {
        userId:1
      };

      const laptopdata = null;

      mockLaptopRepository.findOne.mockResolvedValue(laptopdata);

      await expect(service.deleteLaptopById(1022,mockUser))
      .rejects.toThrow(NotFoundException)
    });
  

  
  it('should throw a ForbiddenException if the user does not own the laptop', async () => {
      const mockUser = { userId: 1 };

      const mockLaptopdata = {    
          id: 1022,
          description: "Hp Laptop",
          brand: "HP",
          ram: 16,
          price: 3000,
          userId: 2 // Different Id from the mock user Id
      };

      mockLaptopRepository.findOne.mockResolvedValue(mockLaptopdata);

      await expect(service.deleteLaptopById(1022, mockUser))
        .rejects.toThrow(ForbiddenException);
    });


    it('should return laptop object over successfull deletion', async () => {
      const mockUser = {
        userId:1,
        username:"Jaedeen"
      }

      const mockLaptopdata = {    
          id: 1022,
          description: "Hp Laptop",
          brand: "HP",
          ram: 16,
          price: 3000,
          userId: 1
      };

      mockLaptopRepository.findOne.mockResolvedValue(mockLaptopdata);
      mockLaptopRepository.remove.mockResolvedValue(mockLaptopdata);
      
      const result = await service.deleteLaptopById(1022,mockUser);

      expect(result).toEqual(mockLaptopdata);
      expect(mockLaptopRepository.findOne).toHaveBeenCalledTimes(1);
      expect(mockLaptopRepository.remove).toHaveBeenCalledWith(mockLaptopdata);
    });
  });
});