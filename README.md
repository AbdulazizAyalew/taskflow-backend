# Taskflow-backend

Backend API for TaskFlow - a task and project management application.

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

## Performance & Database Optimization
* **Redis Caching:** The `GET /laptops` endpoint is heavily optimized using an in-memory Redis store (running via Docker). Responses are cached with a **60-second TTL**, completely bypassing the PostgreSQL database for identical subsequent requests to handle high read traffic.
* **Query Optimization:** Relational endpoints utilize TypeORM `LEFT JOIN`s to eliminate N+1 query bottlenecks.
* **Database Indexes:** High-traffic foreign keys (`userId`) and filtering targets (`brand`) are indexed in PostgreSQL to prevent full-table scans.

## Background Jobs & Message Queues (Bull + Redis)

To ensure fast HTTP response times and prevent the main thread from blocking during heavy I/O tasks (like sending emails or push notifications), this API utilizes an asynchronous background queue powered by **Bull** and **Redis**.

**The Async Flow:**
1. **The Trigger (Producer):** When a laptop is linked to a shop (`POST /shops/:shopId/laptops/:laptopId`), the service saves the link, adds a `laptop-linked` job to the Redis `notifications` queue, and returns `201 Created` without waiting for notification processing.
2. **The Processor (Consumer):** A completely decoupled worker (`NotificationsProcessor`) constantly listens to Redis. It picks up the `laptop-linked` job in the background and processes it (currently simulating a 2-second delay to represent a third-party notification API).
3. **Fault Tolerance:** Bull allows three total attempts (the initial attempt plus two retries), with exponential backoff starting at five seconds.

**How to observe the queue:**
When you trigger the link endpoint, watch your NestJS terminal. You will see the asynchronous lifecycle hooks fire in the background:
* **Success:** You will see debug logs followed by `✅ Job <id> completed.`
* **Failure:** If the processor throws an error, Bull's failure listener catches it and outputs `❌ Job <id> failed: <error message>` before scheduling a retry.

##  Security & API Hardening

This API is built with production-ready security standards:
* **Helmet:** HTTP headers are automatically secured, protecting against clickjacking, cross-site scripting (XSS), and MIME-sniffing. The `X-Powered-By` header is disabled.
* **CORS:** Cross-Origin Resource Sharing is enabled for frontend integration.
* **Rate Limiting:** The gateway allows 10 requests per IP per route handler per minute. `/auth/login` retains the existing code's stricter limit of 3 requests per 6 seconds. Limits are stored in memory per gateway instance.


## Access Control (RBAC & Ownership)

The application enforces strict authorization rules combining Role-Based Access Control (RBAC) and Resource Ownership:

* **Role-Based Access Control (RBAC):** Users are assigned a role of either `user` (default) or `admin`. Specific routes are protected by a `@Roles()` guard. For example, only Admins can view the full list of registered users.
* **Resource Ownership:** Protected laptop creation stores the user ID from the verified JWT. Laptop updates are owner-only. The ID is an external reference, not a foreign key into the separate users database.
* **The Admin Bypass:** Admins can delete another user's laptop, but cannot update it. This preserves the agreed owner-only update rule.
* **Shops:** Shop routes remain public. Creating a shop and its initial laptop assigns no owner to either record, matching the existing behavior.


## Environment Configuration

The application enforces strict environment variable validation on startup using `@nestjs/config` and `Joi`. 
* **Fail-Fast Booting:** If any required environment variable (such as `JWT_SECRET` or database credentials) is missing or incorrectly typed in the `.env` file, the server will immediately crash with a descriptive error rather than failing silently at runtime.

## Standard Response Contract

All successful API responses are intercepted and formatted into a unified, predictable structure. Exceptions are caught by a global filter to ensure error shapes remain consistent and do not leak stack traces.

**Error Response Example:**

```json
{
  "success": false,
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
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

**2. Start infrastructure (PostgreSQL & Redis):**
```bash
docker compose up -d
```
**3. Install and run:**

```bash
npm install
npm run start:dev
```

The app starts on:

```text
http://localhost:3000
```


## How to run the tests

**Microservices verification (Issue 5):** With PostgreSQL, RabbitMQ, and Redis running, use:

```bash
npm run test:microservices:e2e
```

This builds and starts all three apps against temporary databases, queues, and Redis prefixes. It exercises the API examples with curl, verifies auth and ownership, waits for the real 60-second laptop-cache expiry, checks transaction rollback, and observes a completed Bull notification. It cleans up only its test resources. Allow about two minutes. See [the verification report](docs/milestone-13-verification.md).

The following Jest commands describe the legacy monolith tests; the microservices command above is the milestone-13 verification entry point.

This project includes a comprehensive unit testing suite using Jest, heavily utilizing mocking to isolate controllers, services, guards, and strategies without relying on a live database.

**Run standard unit tests:**
```bash
npm run test
```

### Run tests with a coverage report:

```bash
npm run test:cov
```

### Coverage Target:
The project enforces an automated quality gate for test coverage via package.json. The current global threshold is set to 30% (for statements, branches, functions, and lines), specifically excluding NestJS boilerplate files (like modules and DTOs). If coverage drops below this baseline, the test script will fail.


### End-to-End (E2E) Testing

The E2E test suite evaluates the entire application lifecycle by running against an isolated PostgreSQL database hosted inside a Docker container. This architecture guarantees your local development database is never wiped, altered, or polluted during test execution.

**Prerequisite:** You must have Docker and Docker Compose installed and running on your system.

**1. Start the isolated test database:**
Boot the temporary database in the background before running any tests.
```bash
docker compose -f docker-compose.test.yml up -d
```
(Wait approximately 3-5 seconds for the PostgreSQL container to initialize and accept connections on port 5433).

**2. Run the E2E suite:**
```bash
npm run test:e2e
```
The test script automatically applies NODE_ENV=test, commanding NestJS to bypass the standard .env file, read from .env.test, and route all TypeORM traffic securely into the Docker container.

**3. Stop the test database:**

Once testing is complete, cleanly shut down the container and remove its temporary network:

```bash
docker compose -f docker-compose.test.yml down
```

**How Authentication is Handled in the E2E Suite:**

To test protected endpoints without manual token generation, the E2E suite utilizes an automated authentication helper within Jest's beforeAll setup phase. Before the primary tests execute, the framework automatically:

1. Wipes the test database completely clean using TypeORM's synchronize(true).
2. Registers three distinct test actors via the API: a standard Owner, a secondary Bystander, and an Admin (promoted via a raw SQL query).
3. Executes login requests for all three actors to extract cryptographically signed JWTs.
4. Programmatically injects these tokens into the Supertest Authorization headers to systematically verify Role-Based Access Control (RBAC) and strict Resource Ownership rules across the application.









## API Call Guide: Authentication Flow

To modify laptops, you must first register and log in to receive an access token. Note: All endpoints validate incoming data; passing invalid data will result in a 400 Bad Request.

These examples target the gateway on port 3000. Start it and both services using [the gateway run instructions](apps/gateway/README.md). Replace token and ID placeholders with values returned by your requests; database IDs are generated automatically. When creating records for the first time, run the create example before the read/update/delete examples that use its ID. If you hit a rate limit while running examples quickly, wait for that route's window to reset.

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
  "success": true,
  "data": {
    "access_token": "your_signed_jwt"
  },
  "timestamp": "2026-09-07T00:00:00.000Z"
}
```
Copy `data.access_token` from the response. You will need it for the protected routes below. Registration and login return HTTP 201, matching the existing POST behavior.

## API Call Guide: Users (Admin Only)

### Get all users
This route is protected by the `RolesGuard` and requires the `admin` role.

**Denied (Regular User):**
```bash
curl -X GET http://localhost:3000/users \
-H "Authorization: Bearer <regular_user_token>"



```
Response: 403 Forbidden, with the standard error wrapper.

**Allowed (Admin User):**

```bash
curl -X GET http://localhost:3000/users \
-H "Authorization: Bearer <admin_token>"

```
Response: 200 OK, with the user array in `data`. Password hashes are excluded. Admin status must be assigned in the users database; log in again after promotion to get a token with the admin role.

## API Call Guide: Laptops

#### Get all laptops (Public Route - Cached & Paginated)
This endpoint supports pagination, sorting, and filtering via URL query parameters. Responses are cached for 60 seconds.

**Supported Query Parameters:**
* `page`: Page number (default: 1)
* `limit`: Items per page (default: 10)
* `sort`: Column to sort by (default: 'id')
* `order`: 'ASC' or 'DESC' (default: 'ASC')
* `brand`: Filter by exact laptop brand
* `minPrice` / `maxPrice`: Filter by price range

**Basic Request (Defaults):**
```bash
curl -X GET http://localhost:3000/laptops
```
**Advanced Request (Filtering, Sorting & Pagination):**
```bash
curl -X GET "http://localhost:3000/laptops?brand=Apple&minPrice=50000&maxPrice=200000&sort=price&order=DESC&page=1&limit=5"
```
**Example response:**
```bash
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "userId": null,
        "description": "A brand new Macbook",
        "brand": "Apple",
        "ram": 16,
        "price": 150000
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 5,
      "lastPage": 1
    }
  },
  "timestamp": "2026-09-01T12:00:00.000Z"
}
```

### Get laptop by ID (Public Route)

```bash
curl -X GET 'http://localhost:3000/laptops/<laptop_id>'
```

### Create a new laptop (Protected Route)
Replace <your_token_here> with the JWT you received from the login route.

```bash
curl -X POST http://localhost:3000/laptops \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token_here>" \
-d '{"brand": "Dell XPS 15", "description": "Brand new Dell", "ram": 32, "price": 180000}'
```

### Update a laptop (Resource Ownership Check)

Regular users can only update laptops they created. 

**Allowed (User owns the laptop):**
```bash
curl -X PATCH 'http://localhost:3000/laptops/<laptop_id>' \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token_here>" \
-d '{"price": 115000}'
```

**Denied (User tries to update another user's laptop):**
```bash
curl -X PATCH 'http://localhost:3000/laptops/<laptop_id>' \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <other_users_token>" \
-d '{"price": 115000}'
```

**Response:**
```bash
{
  "success": false,
  "statusCode": 403,
  "message": "You can only edit your own laptops"
}
```

### Delete a laptop (Resource Ownership Check)
**Allowed (User owns the laptop):**
```bash
curl -X DELETE 'http://localhost:3000/laptops/<laptop_id>' \
-H "Authorization: Bearer <your_token_here>"
```
**Denied (User tries to delete another user's laptop):**

```bash
curl -X DELETE 'http://localhost:3000/laptops/<laptop_id>' \
-H "Authorization: Bearer <other_users_token>"
```
Response: 403 Forbidden. Run the denied example before deleting the record; an already deleted laptop returns 404.

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
curl -X POST 'http://localhost:3000/shops/<shop_id>/laptops/<laptop_id>'
```

### Get all Shops (Includes nested Laptop inventory)
``` bash
curl -X GET http://localhost:3000/shops
```
Response includes the shop details and an array of linked laptops.

### Find all Shops selling a specific Laptop ID

``` bash
curl -X GET 'http://localhost:3000/shops/laptop/<laptop_id>'
```

## Notes
- This project uses a PostgreSQL database mapped with TypeORM, fully replacing the previous in-memory data structure.

- The data access layer demonstrates relational database concepts, including @ManyToMany relationships and atomic transactions using TypeORM's QueryRunner.

- The codebase is intentionally small, so the NestJS controller/service/module structure remains easy to follow end-to-end.
