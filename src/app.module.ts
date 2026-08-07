import { LaptopsModule } from './laptops/laptops.module';
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LaptopsModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
