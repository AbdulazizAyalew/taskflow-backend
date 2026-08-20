# Taskflow-backend

Backend API for TaskFlow — a task and project management application.

This repository is a NestJS API that exposes feature areas for laptops, shops, and users. The application is backed by a PostgreSQL database and utilizes TypeORM for data mapping and atomic transactions.

## What the project does

The app starts in [src/main.ts](src/main.ts), which creates the Nest application and listens on port 3000.

The root application wiring lives in [src/app.module.ts](src/app.module.ts). That file imports two feature modules:

- `LaptopsModule`
- `ShopsModule`
- `UsersModule`

## How the pieces fit together

### 1. `AppModule`

File: [src/app.module.ts](src/app.module.ts)

`AppModule` is the root module. It establishes the PostgreSQL database connection via TypeORM and imports the feature modules.

### 2. `LaptopsModule`

File: [src/laptops/laptops.module.ts](src/laptops/laptops.module.ts)

This module handles the `Laptop` entity.
- The HTTP route handling lives in `LaptopsController`.
- The data-access layer lives in `LaptopsService`, using injected TypeORM repositories to interact with the database.


### 3. `ShopsModule`

File: [src/shops/shops.module.ts](src/shops/shops.module.ts)

This module manages the `Shop` entity, which shares a `@ManyToMany` database relationship with Laptops.
- Features atomic database transactions (QueryRunner) to ensure data integrity when creating new shops alongside initial inventory.
- Handles junction-table querying to filter shops by the laptops they carry.

### 4. `UsersModule`
Handles user registration, authentication, and JWT token generation.


## 🛡️ Security & API Hardening

This API is built with production-ready security standards:
* **Helmet:** HTTP headers are automatically secured, protecting against clickjacking, cross-site scripting (XSS), and MIME-sniffing. The `X-Powered-By` header is disabled.
* **CORS:** Cross-Origin Resource Sharing is enabled for frontend integration.
* **Rate Limiting:** A global limit of 10 requests per minute is enforced per IP address to prevent abuse. Critical routes, such as `/auth/login`, enforce a stricter limit of 3 requests per minute to prevent brute-force attacks.

## Environment Configuration

The application enforces strict environment variable validation on startup using `@nestjs/config` and `Joi`. 
* **Fail-Fast Booting:** If any required environment variable (such as `JWT_SECRET` or database credentials) is missing or incorrectly typed in the `.env` file, the server will immediately crash with a descriptive error rather than failing silently at runtime.

## Standard Response Contract

All successful API responses are intercepted and formatted into a unified, predictable structure. Exceptions are caught by a global filter to ensure error shapes remain consistent and do not leak stack traces.

**Error Response Example:**

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests",
  "timestamp": "2026-08-20T06:48:33.199Z",
  "path": "/laptops"
}
```

## How to run the project

From the repository root in WSL or a Node-enabled shell:

**1. Set up your environment variable** : 
Create a .env file in the root of the project to define your PostgreSQL connection details and JWT secret (refer to .env.example for the required schema):
```bash
PORT=3000
JWT_SECRET=your_super_secret_key_here
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_DATABASE=taskflow_db
```

**2. Install and run**:

```bash
npm install
npm run start:dev
```

The app starts on:

```text
http://localhost:3000
```

## API Call Guide: Authentication Flow

To modify laptops, you must first register and log in to receive an access token. Note: All endpoints validate incoming data; passing invalid data will result in a 400 Bad Request.

### 1. Register a new user

```bash
curl -X POST http://localhost:3000/auth/register \
-H "Content-Type: application/json" \
-d '{"username": "testuser", "password": "mypassword123"}'
```

### 2. Log in (Get your Token)

```bash
curl -X POST http://localhost:3000/auth/login \
-H "Content-Type: application/json" \
-d '{"username": "testuser", "password": "mypassword123"}'
```
Example response:
```bash
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ..."
}
```
Copy the access_token string from the response. You will need it for the protected routes below.

## API Call Guide: Laptops

### Get all laptops (Public Route)

```bash
curl -X GET http://localhost:3000/laptops
```

Example response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1022,
      "description": "A brand new Lenovo Laptop",
      "brand": "Lenovo Yoga",
      "ram": 16,
      "price": 125000
    }
  ],
  "timestamp": "2026-08-20T12:00:00.000Z"
}
```

### Get laptop by ID (Public Route)

```bash
curl -X GET http://localhost:3000/laptops/1022
```

### Create a new laptop (Protected Route)
Replace <your_token_here> with the JWT you received from the login route.

```bash
curl -X POST http://localhost:3000/laptops \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token_here>" \
-d '{"id": 1025, "brand": "Dell XPS 15", "description": "Brand new Dell", "ram": 32, "price": 180000}'
```

### Update a laptop (Protected Route)
```bash
curl -X PATCH http://localhost:3000/laptops/1022 \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token_here>" \
-d '{"price": 115000}'
```

### Delete a laptop (Protected Route)
```bash
curl -X DELETE http://localhost:3000/laptops/1022 \
-H "Authorization: Bearer <your_token_here>"
```


## API Call Guide: Shops & Relations
### Create a Shop AND an initial Laptop (Atomic Transaction)
This endpoint uses a database transaction. If either the shop or laptop data fails validation or saving, both are rolled back and neither is saved to the database.

``` bash
curl -X POST http://localhost:3000/shops \
-H "Content-Type: application/json" \
-d '{
  "shop": {
    "name": "Addis Tech Hub",
    "location": "Bole"
  },
  "laptop": {
    "description": "A brand new Macbook",
    "brand": "Apple",
    "ram": 16,
    "price": 150000
  }
}'
```

### Link an existing Laptop to an existing Shop
Populates the @ManyToMany junction table to add a laptop to a shop's inventory.

``` bash
curl -X POST http://localhost:3000/shops/1/laptops/1
```

### Get all Shops (Includes nested Laptop inventory)
``` bash
curl -X GET http://localhost:3000/shops
```
Response includes the shop details and an array of linked laptops.

### Find all Shops selling a specific Laptop ID

``` bash
curl -X GET http://localhost:3000/shops/laptop/1
```

## Notes
- This project uses a PostgreSQL database mapped with TypeORM, fully replacing the previous in-memory data structure.

- The data access layer demonstrates relational database concepts, including @ManyToMany relationships and atomic transactions using TypeORM's QueryRunner.

- The codebase is intentionally small, so the NestJS controller/service/module structure remains easy to follow end-to-end.