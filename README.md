# Taskflow-backend

Backend API for TaskFlow — a task and project management application.

This repository is a small NestJS API that currently exposes one feature area: laptops.

## What the project does

The app starts in [src/main.ts](src/main.ts), which creates the Nest application and listens on port 3000.

The root application wiring lives in [src/app.module.ts](src/app.module.ts). That file imports only one feature module:

- `LaptopsModule`

That means the entire application currently routes through the laptop feature.

## How the pieces fit together

### 1. `AppModule`

File: [src/app.module.ts](src/app.module.ts)

`AppModule` is the root module. It does not contain business logic itself; it simply imports `LaptopsModule`.

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

This controller is the HTTP entry point. Its route is:

- `@Controller('laptops')`

The method `getLaptops()` is mapped to `GET /laptops`, and it delegates to the service:

```ts
return this.laptopsService.loadLaptops('./src/datas/Laptops.json');
```

So the controller receives the request, then asks the service to read the laptop dataset.

### 4. `LaptopsService`

File: [src/laptops/laptops.service.ts](src/laptops/laptops.service.ts)

This service is the data-access layer for this project. It does not use a database or ORM.

Instead, it:

1. reads the file from `./src/datas/Laptops.json`
2. parses the JSON string
3. returns the array of laptop objects

The actual seed data file is [src/datas/Laptops.json](src/datas/Laptops.json).

## Runtime flow

If you start the app, the request flow is:

1. `src/main.ts` boots the Nest app
2. `AppModule` imports `LaptopsModule`
3. `LaptopsController` handles `GET /laptops`
4. `LaptopsService` reads [src/datas/Laptops.json](src/datas/Laptops.json)
5. the JSON array is returned to the client

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

## Notes

- This project currently uses a static JSON file rather than a database.
- The laptop endpoint is the only API surface implemented in the repo right now.
- The codebase is intentionally small, so the controller/service/module structure is easy to follow end-to-end.
