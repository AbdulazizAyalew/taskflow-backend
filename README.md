# Taskflow backend

A NestJS monorepo for users, authentication, laptops, and shops. Clients use one
HTTP gateway; two independent services process requests through RabbitMQ and own
separate PostgreSQL databases.

## Architecture

```mermaid
flowchart TD
    Client["Client / curl / frontend"] <-->|HTTP on port 3000| Gateway["API gateway"]
    Gateway <-->|Request and reply| RabbitMQ["RabbitMQ"]
    RabbitMQ <--> Users["user-service"]
    RabbitMQ <--> Catalog["catalog-service"]
    Users --> UserDB[("taskflow_users")]
    Catalog --> CatalogDB[("taskflow_catalog")]
    Catalog -->|Laptop list cache| Redis[("Redis")]
    Catalog --> Bull["Bull: notifications queue and worker"]
    Bull --> Redis
```

Both databases run inside one PostgreSQL container. Redis serves the cache and
Bull jobs; RabbitMQ carries service requests and replies. These are different
responsibilities, so both brokers remain in the project.

| Application | Owns | Start command | Details |
| --- | --- | --- | --- |
| Gateway | HTTP routes, validation, response formatting, rate limits, Helmet and CORS | `npm run start:gateway` | [Gateway README](apps/gateway/README.md) |
| user-service | Registration, password hashes, login, JWT issuing, admin user list | `npm run start:user-service` | [User README](apps/user-service/README.md) |
| catalog-service | Laptops, shops, ownership, local transactions, caching and notifications | `npm run start:catalog-service` | [Catalog README](apps/catalog-service/README.md) |

The apps live in `apps/gateway`, `apps/user-service`, and `apps/catalog-service`.
They share the repository and dependency installation but run as separate
processes. Only the gateway listens for HTTP; the other apps consume RabbitMQ
queues.

The old application remains in `apps/taskflow-backend` as a migration reference.
The default `npm start` and `npm run start:dev` still target that monolith.
Use the explicit service commands below for the microservices architecture.

## Quick start

Prerequisites: Node.js with npm, Docker with Docker Compose, and curl. Commands
below run from the repository root. OpenSSL is used only to generate a JWT secret.

### 1. Install dependencies and start infrastructure

```bash
npm ci
docker compose up -d postgres rabbitmq redis
```

Wait for PostgreSQL and RabbitMQ to become ready. These checks should succeed;
if either is still starting, wait briefly and repeat it:

```bash
docker compose exec -T postgres pg_isready -U postgres
docker compose exec -T rabbitmq rabbitmq-diagnostics -q ping
docker compose exec -T redis redis-cli ping
```

### 2. Create the databases once

On a fresh PostgreSQL volume:

```bash
docker compose exec postgres createdb -U postgres taskflow_users
docker compose exec postgres createdb -U postgres taskflow_catalog
```

If a database already exists, keep it and skip its creation command. Each service
creates its tables on startup with `DB_SYNCHRONIZE=true`. This is the local
development setup; schema migrations are needed before production use.

### 3. Create the application environment files

These commands preserve existing files:

```bash
test -f apps/user-service/.env || cp apps/user-service/.env.example apps/user-service/.env
test -f apps/catalog-service/.env || cp apps/catalog-service/.env.example apps/catalog-service/.env
test -f apps/gateway/.env || cp apps/gateway/.env.example apps/gateway/.env
```

Generate a secret once:

```bash
openssl rand -hex 32
```

Replace `JWT_SECRET` in **both** `apps/user-service/.env` and
`apps/catalog-service/.env` with that same value. Keep an existing shared secret
if both apps are already configured. The gateway does not need a JWT secret.

The example files already contain the local Docker connection settings:

| Setting | user-service | catalog-service | Gateway |
| --- | --- | --- | --- |
| Database | `taskflow_users` | `taskflow_catalog` | None |
| Database host/port | `localhost:5434` | `localhost:5434` | None |
| RabbitMQ request queue | `RABBITMQ_QUEUE=user_queue` | `RABBITMQ_QUEUE=catalog_queue` | `USER_QUEUE=user_queue`, `CATALOG_QUEUE=catalog_queue` |
| RabbitMQ URL | `amqp://taskflow:taskflow_local@localhost:5672` | Same broker | Same broker |
| Redis | None | `localhost:6379`, database 0 | None |
| HTTP port | None | None | `PORT=3000` |

Environment files are ignored by Git. The service-specific files are loaded
relative to the repository root; the root monolith `.env` is not their config.

### 4. Start all three applications

Use three terminals, each at the repository root.

Terminal 1:

```bash
npm run start:user-service
```

Terminal 2:

```bash
npm run start:catalog-service
```

Terminal 3:

```bash
npm run start:gateway
```

The services should report `Nest microservice successfully started`; the gateway
reports its HTTP address. For watch mode, use `npx nest start user-service --watch`,
`npx nest start catalog-service --watch`, or `npx nest start gateway --watch`.

### 5. Verify the running system

Open [RabbitMQ management](http://localhost:15672) and log in with username
`taskflow` and password `taskflow_local`. Under **Queues and Streams**,
`user_queue` and `catalog_queue` should each have one consumer for one running
instance of each service.

```bash
curl http://localhost:3000/laptops
```

A fresh database returns HTTP 200 with an empty `data.items` array. Use the auth
examples below to register and log in. The gateway stays on the old API's port,
so stop the old monolith if it already occupies port 3000.

### Stop and restart

Stop each Nest process with `Ctrl+C`. To stop infrastructure without removing it:

```bash
docker compose stop
```

Run the infrastructure and application start commands again to resume. PostgreSQL
and RabbitMQ use named volumes. Redis currently has no named volume: recreating
its container can lose cached entries and queued notification jobs.

## Local ports and credentials

| Component | Host port | Container port | Local credentials |
| --- | --- | --- | --- |
| Gateway HTTP | 3000 | Apps run on the host | JWT on protected routes |
| PostgreSQL | 5434 | 5432 | `postgres / postgres_local` |
| RabbitMQ AMQP | 5672 | 5672 | `taskflow / taskflow_local` |
| RabbitMQ management UI | 15672 | 15672 | Same RabbitMQ account |
| Redis | 6379 | 6379 | No password in this local setup |

These are local development credentials. Host port 5434 avoids the locally
installed PostgreSQL on 5432 and the old test container on 5433. If apps are later
containerized, their connection hosts/ports must use Docker service networking;
the current example files are for Nest processes running on your computer.

## Request flow and JWT verification

A login request goes from the client to `POST /auth/login` on the gateway. The
gateway sends `user.login` to `user_queue`; user-service checks the password and
returns a signed token through RabbitMQ. The gateway wraps that reply once and
returns HTTP 201 with the JWT at `data.access_token`.

For a protected catalog request, the gateway extracts the bearer token and sends
it with the request data to `catalog_queue`. Catalog's local JWT strategy checks
its signature, expiry, numeric user ID, and role using the shared `JWT_SECRET`.
It then compares that verified user ID with the laptop's owner ID. It does not
query user-service for each ownership check.

Tokens use HS256, contain `sub`, `username`, and `role`, and expire after one hour.
Both services holding the shared secret can sign as well as verify tokens.
Changing or deleting an account does not immediately revoke existing tokens.
Role promotion requires a new login to obtain the updated role in a new token.

## Data ownership and permissions

- user-service owns only the users database. Registration creates regular users
  and hashes passwords with bcrypt. Passwords and hashes are never returned.
- Catalog owns laptops, shops, and their inventory junction table. Owner IDs are
  integer references, without a TypeORM relation or foreign key to the users DB.
- Laptop updates are owner-only, including for admins. Deletion allows the owner
  or an admin. Laptop reads are public.
- Shop routes remain public. Creating a shop and its initial laptop assigns no
  owner to either record; no new shop ownership rules were introduced.
- Creating a shop and its initial laptop is one catalog database transaction:
  if either save fails, both roll back.

The databases share one PostgreSQL server and the same local database role.
Service ownership is enforced by application boundaries; separate database
credentials and privileges have not been introduced in this local milestone.

To prepare an admin for manual testing, register a separate account, open the
users database, and promote only that account:

```bash
docker compose exec postgres psql -U postgres -d taskflow_users
```

```sql
UPDATE users SET role = 'admin' WHERE username = 'your_admin_username';
```

Exit with `\q`, then log in again. A normal account is needed for the denied-access
examples; public registration cannot choose the admin role.

## Caching, background jobs, and failures

Only `GET /laptops` results are cached in Redis for 60 seconds, with keys covering
pagination, sorting, and filters. Writes deliberately do not clear the cache.
Single-laptop and shop reads use the database directly. Cache errors fall back to
database reads.

Linking a laptop to a shop adds a `laptop-linked` Bull job to Redis. Catalog's
notification worker processes it in the background, currently simulating two
seconds of work. Bull uses the `notifications` queue with prefix `catalog`, three
total attempts, and exponential backoff starting at five seconds. Re-linking an
existing laptop does not duplicate the relationship or enqueue another job.

The link is committed before enqueueing, so a queue failure can leave a saved link
without a notification. An outbox is not implemented. Old monolith Bull jobs are
not migrated to the catalog prefix.

The gateway waits at most five seconds for a service reply and does not
automatically retry writes. Missing replies return HTTP 504; broker connection
failures return 503. Requests carry a five-second RabbitMQ expiry, but timing out
does not cancel or roll back a write already delivered to a service.

Both services use durable RabbitMQ queue definitions and automatic
acknowledgement. A consumer crash can therefore lose an already delivered request;
durable queue definitions alone do not guarantee message processing or replies.

## HTTP response contract and security

The gateway owns validation, response formatting, Helmet, CORS, and HTTP rate
limiting. Services also validate messages and enforce their own permissions.

Successful replies are wrapped exactly once:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-09-07T00:00:00.000Z"
}
```

Errors use:

```json
{
  "success": false,
  "message": "Invalid credentials",
  "statusCode": 401
}
```

POST routes return 201; GET, PATCH and DELETE return 200 on success. Business and
validation errors preserve their service status codes; internal details are
sanitized. The gateway allows 10 requests per IP per route handler per minute,
with login limited to 3 requests per 6 seconds. Counters are in memory per gateway
instance, and proxy headers are not trusted as client identity.

## Tests and builds

Start infrastructure and configure the app environment files first. Then run:

```bash
npm run test:user-service:e2e
npm run test:catalog-service:e2e
npm run test:microservices:e2e
```

The first two commands test their service over RabbitMQ. The last builds all
three apps and runs the complete curl suite through an isolated gateway, including
the README payloads, auth, ownership, transaction rollback, notification
completion, rate limits, and failures. It waits for the real 60-second cache
expiry; allow about two minutes.

Tests create uniquely named databases, RabbitMQ queues, and Redis prefixes, then
remove only their own resources. The configured local PostgreSQL account needs
permission to create and drop test databases. An assertion failure still runs
cleanup; forcibly terminating the test can leave temporary resources behind.

See [the Issue 5 verification report](docs/milestone-13-verification.md).
`npm run test:gateway:e2e` is an alias entry point for the same full gateway suite.
Legacy `npm test`, coverage, and `test:e2e` scripts remain from the monolith;
they are not the microservices test commands.

To compile without starting the applications:

```bash
npx nest build user-service
npx nest build catalog-service
npx nest build gateway
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Port 3000 is occupied | Stop the old monolith or choose a different gateway `PORT` and use that port in curl |
| Database connection refused | Ensure PostgreSQL is ready and both app files use host port 5434 |
| Database does not exist | Run its one-time `createdb` command |
| RabbitMQ connection refused | Check the container and AMQP port 5672; 15672 is only the dashboard |
| Queue has zero consumers | Start its service and check startup logs |
| Unexpected replies or multiple consumers | Stop any old placeholder processes still consuming the same queue |
| Catalog rejects a valid login token | Check the shared JWT secret, token expiry, and the raw bearer token |
| HTTP 429 while testing | Wait for the route's rate-limit window to reset |
| Laptop list looks outdated | The agreed cache policy allows stale results for up to 60 seconds |
| Nest reports a missing internal helper | Use `npm ci` with the committed lockfile; keep Nest core and microservices versions aligned |


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
