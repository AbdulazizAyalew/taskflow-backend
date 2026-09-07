import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { User } from 'src/users/user.entity';


const mockReflector = {
    getAllAndOverride:jest.fn(),
}

const mockRequest = jest.fn();

const mockContext = {
  getHandler:jest.fn(),
  getClass: jest.fn(),
  switchToHttp: jest.fn().mockReturnValue({
    getRequest: mockRequest,
  })
} as unknown as ExecutionContext;



describe('RolesGuard', () => {
  let rolesGuard: RolesGuard;

  beforeEach(async () => {

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    rolesGuard = module.get<RolesGuard>(RolesGuard);
  });

  it('should be defined', () => {
    expect(rolesGuard).toBeDefined();
  });


  describe('canActivate', () => {

    it('should throw a ForbiddenException if the user is not found in the request', () => {


        mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

        mockRequest.mockReturnValue({
          user:undefined
        })

        expect(() => {
          rolesGuard.canActivate(mockContext)
        }).toThrow(ForbiddenException);

    });


  it('should throw a ForbiddenException if the user does not have the required role',() => {

    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    mockRequest.mockReturnValue({
      user: {role: UserRole.USER},
    });

    expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);

  });


  it('should return true if the user possesses the required role',()=>{
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    mockRequest.mockReturnValue({
      user: {role: UserRole.ADMIN},
    });

    const result = rolesGuard.canActivate(mockContext);

    expect(result).toEqual(true);
  });


  it('should return true if the route is unprotected (no required roles)',()=>{
    mockReflector.getAllAndOverride.mockReturnValue(null);

    mockRequest.mockReturnValue({
      user: {role: UserRole.USER},
    });

    const result = rolesGuard.canActivate(mockContext);

    expect(result).toEqual(true);
  });

});

});