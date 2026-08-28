import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

const mockConfigService = {
  get: jest.fn(),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {

    mockConfigService.get.mockReturnValue('2231583rywegr132rger72304281iyewfbcuewc927334');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {

    it('should return a user object when provided a valid payload', async () => {
      
        const validPayload = {
        sub: 10,
        username: 'abdulaziz',
        role: 'admin',
        iat: 1692345600,
        exp: 1692349200,
      };

      const expectedUser = {
        userId: 10,
        username: 'abdulaziz',
        role: 'admin',
      };
      
      const result = await strategy.validate(validPayload);

      expect(result).toEqual(expectedUser);
    });

    it('should map missing payload properties to undefined', async () => {
      const malformedPayload = {
        sub: 10,
      };

      const expectedUser = {
        userId: 10,
        username: undefined,
        role: undefined,
      };

      const result = await strategy.validate(malformedPayload);

      expect(result).toEqual(expectedUser);
    });
  });
});