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

```bash
cd /home/jaedeen/Pitron/taskflow-backend
npm install
npm run start:dev
```


The app starts on:

```text
http://localhost:3000
```

## API call

### Get all laptops

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

### Get laptop by ID

```bash
curl -X GET http://localhost:3000/laptops/1022
```

### Create a new laptop
```bash
curl -X POST http://localhost:3000/laptops \
-H "Content-Type: application/json" \
-d '{"id": 1025, "brand": "Dell XPS 15", "description": "Brand new Dell", "ram": 32, "price": 180000}'
```

### Update a laptop (PATCH)
```bash
curl -X PATCH http://localhost:3000/laptops/1022 \
-H "Content-Type: application/json" \
-d '{"price": 115000}'
```

### Delete a laptop
```bash
curl -X DELETE http://localhost:3000/laptops/1022
```


## Notes

- This project currently uses an in-memory array rather than a database.
- The codebase is intentionally small, so the controller/service/module structure is easy to follow end-to-end.
