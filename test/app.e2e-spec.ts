import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';
import helmet from 'helmet';

describe('TaskFlow E2E Suite & Auth Helper', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.use(helmet());
    
    app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
    
    app.useGlobalInterceptors(new TransformInterceptor());
    
    app.useGlobalFilters(new GlobalExceptionFilter());

    app.enableCors();
    
    await app.init();

    const dataSource = app.get(DataSource);
    await dataSource.synchronize(true);

    const testCredentials = { username: 'e2e_user', password: 'e2e_password' };

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testCredentials)
      .expect(201); 

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testCredentials)
      .expect(201); 

    jwtToken = loginResponse.body.data ? loginResponse.body.data.access_token : loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully register, login, and return a valid JWT structure', () => {
    expect(jwtToken).toBeDefined();
    expect(typeof jwtToken).toBe('string');
    
    const jwtParts = jwtToken.split('.');
    expect(jwtParts.length).toBe(3);
  });
});