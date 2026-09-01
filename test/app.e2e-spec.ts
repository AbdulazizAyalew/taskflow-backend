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
  let ownerToken: string;
  let otherUserToken: string;
  let adminToken: string;
  let testLaptopId1: number;
  let testLaptopId2: number;
  let testLaptopId3: number;

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



    const testCredentials = { username: 'otherUser', password: 'otherUserPassword' };

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testCredentials)
      .expect(201); 

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testCredentials)
      .expect(201); 

    otherUserToken = loginResponse.body.data ? loginResponse.body.data.access_token : loginResponse.body.access_token;



    const adminCredentials = { username: 'admin', password: 'adminPassword' };

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(adminCredentials)
      .expect(201); 

    await dataSource.query(
      `UPDATE users SET role = 'admin' WHERE username = 'admin'`
    );

    const adminloginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(adminCredentials)
      .expect(201); 

    adminToken = adminloginResponse.body.data ? adminloginResponse.body.data.access_token : adminloginResponse.body.access_token;



    const ownerCredentials = { username: 'owner', password: 'ownerPassword' };

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(ownerCredentials)
      .expect(201); 

    const ownerloginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(ownerCredentials)
      .expect(201); 

    ownerToken = ownerloginResponse.body.data ? ownerloginResponse.body.data.access_token : ownerloginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully register, login, and return a valid JWT structure', () => {
    expect(ownerToken).toBeDefined();
    expect(typeof ownerToken).toBe('string');

    expect(otherUserToken).toBeDefined();
    expect(typeof otherUserToken).toBe('string');

    expect(adminToken).toBeDefined();
    expect(typeof adminToken).toBe('string');
    

    const ownerjwtParts = ownerToken.split('.');
    expect(ownerjwtParts.length).toBe(3);

    const otherjwtParts = otherUserToken.split('.');
    expect(otherjwtParts.length).toBe(3);

    const adminJwtParts = adminToken.split('.');
    expect(adminJwtParts.length).toBe(3);
  });




  describe('Laptops CRUD Operations', () => {


    it('POST /laptops — unauthenticated fails (401)', async () => {
      return request(app.getHttpServer())
        .post('/laptops')
        .send({ brand: 'Lenovo', description: 'Test Laptop', ram: 16, price: 100000 })
        .expect(401);
    });


    it('POST /laptops —  authenticated succeeds (Owner)', async () => {

      const laptopids:any = [];
      const Laptops = [{ brand: 'Lenovo', description: 'Test Laptop', ram: 16, price: 100000 },{ brand: 'HP', description: 'HP LAPTOPS', ram: 16, price: 100000 },{ brand: 'MACBOOK', description: 'Macbook M5 PRO', ram: 24, price: 30000 }];

      for (const laptop of Laptops){
        const createResponse = await request(app.getHttpServer())
          .post('/laptops')
          .set('Authorization',`Bearer ${ownerToken}`)
          .send(laptop)
          .expect(201);

        if (createResponse.status === 400) {
          console.log('VALIDATION FAILED:', createResponse.body);
        }

        const testLaptopId = createResponse.body.data ? createResponse.body.data.id : createResponse.body.id;
        expect(testLaptopId).toBeDefined();

        laptopids.push(testLaptopId);
      }
      [testLaptopId1,testLaptopId2,testLaptopId3] = laptopids;
      
    });


    it('Get /laptops - unauthenicated route', async () => {
      const response = await request(app.getHttpServer())
        .get('/laptops')
        .send()
        .expect(200)

      const responseData = response.body.data ? response.body.data : response.body;

      const laptops = responseData.items;

      expect(Array.isArray(laptops)).toBeTruthy();
      expect(laptops.length).toBeGreaterThan(0);
      expect(laptops[0].brand).toBe('Lenovo');

      expect(responseData.meta).toBeDefined();
      expect(responseData.meta.page).toBe(1);
    });


    it('Patch /laptops/:id - unauthenticated fails (401)',async () => {
      return request(app.getHttpServer())
        .patch(`/laptops/${testLaptopId1}`)
        .send({description:'Laptop with 8GB RAM'})
        .expect(401)
    });


    it('PATCH /laptops/:id - owner succeeds', async () => {
      return request(app.getHttpServer())
        .patch(`/laptops/${testLaptopId1}`)
        .set('Authorization',`Bearer ${ownerToken}`)
        .send({description:'Laptop with 8GB RAM'})
        .expect(200)
    });



    it('PATCH /laptops/:id - otherUser fails (403)', async () => {
      return request(app.getHttpServer())
        .patch(`/laptops/${testLaptopId2}`)
        .set('Authorization',`Bearer ${otherUserToken}`)
        .send({description:'Laptops with 8GB RAM'})
        .expect(403)
    });


    it('DELETE /laptops/:id - unauthenticated fails (401)', async () => {
      return request(app.getHttpServer())
        .delete(`/laptops/${testLaptopId1}`)
        .send()
        .expect(401)
    });


    it('DELETE /laptops/:id - owner Succeeds', async () => {
      return request(app.getHttpServer())
        .delete(`/laptops/${testLaptopId1}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send()
        .expect(200)
    });


    it('DELETE /laptops/:id - admin Succeeds', async () => {
      return request(app.getHttpServer())
        .delete(`/laptops/${testLaptopId3}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send()
        .expect(200)
    });


    it('DELETE /laptops/:id - other User fails (403)', async () => {
      return request(app.getHttpServer())
        .delete(`/laptops/${testLaptopId2}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send()
        .expect(403)
    });

  });
});