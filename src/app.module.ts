import { LaptopsModule } from './laptops/laptops.module';
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';

@Module({
  imports: [LaptopsModule, UsersModule], 
})
export class AppModule {}
