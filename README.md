# Taskflow-backend

Backend API for TaskFlow — a task and project management application.

This repository is a small NestJS API that currently exposes one feature area: laptops.

## What the project does

The app starts in [src/main.ts](src/main.ts), which creates the Nest application and listens on port 3000.

The root application wiring lives in [src/app.module.ts](src/app.module.ts). That file imports two feature modules:

- `LaptopsModule`
- `UsersModule`

## How the pieces fit together

### 1. `AppModule`

File: [src/app.module.ts](src/app.module.ts)

`AppModule` is the root module. It does not contain business logic itself; it simply imports `LaptopsModule` and `UsersModule`.

### 2. `LaptopsModule`

File: [src/laptops/laptops.module.ts](src/laptops/laptops.module.ts)

This module is where the laptop feature is registered:

- `controllers: [LaptopsController]`
- `providers: [LaptopsService]`

In plain terms, this module says:

- the HTTP route handling for laptops lives in `LaptopsController`
- the data-loading logic lives in `LaptopsService`

### 3. `LaptopsController`

File: [src/laptops/laptops.controller.ts](src/laptops/laptops.controller.ts)

This controller is the HTTP entry point. Its route is `@Controller('laptops')`. It handles GET, POST, PATCH, and DELETE requests and delegates them to the service.


### 4. `LaptopsService`

File: [src/laptops/laptops.service.ts](src/laptops/laptops.service.ts)

This service is the data-access layer for this project. It does not use a database or ORM. Currently, it holds the laptop data as a class-level, in-memory array (seeded with existing data).

### 5. `UsersModule`
Scaffolding for the `UsersModule` (Module, Controller, Service) is in place and registered in the `AppModule`. CRUD logic will be implemented in a future milestone.


## How to run the project

From the repository root in WSL or a Node-enabled shell:

**1. Set up your environment variable** : 
Create a `.env` file in the root of the project and add a secret key for JWT signing:
```bash
echo "JWT_SECRET=your_super_secret_key_here" > .env
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
[
  {
    "id": 1022,
    "description": "A brand new Lenovo Laptop",
    "brand": "Lenovo Yoga",
    "ram": 16,
    "price": 125000
  }
]
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


## Notes

- This project currently uses an in-memory array rather than a database.
- The codebase is intentionally small, so the controller/service/module structure is easy to follow end-to-end.
