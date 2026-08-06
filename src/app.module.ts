import { LaptopsModule } from './laptops/laptops.module';
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';


@Module({
  imports: [LaptopsModule, UsersModule, AuthModule ], 
})
export class AppModule {}
