# API gateway — Issue 4

The gateway is the public HTTP entry point on port 3000. It forwards requests to
user-service and catalog-service through RabbitMQ using `ClientProxy.send()` and
awaits each reply. It has no database, cache, or JWT signing secret.

## Run from the repository root

Start infrastructure with `docker compose up -d postgres rabbitmq redis`.
The service databases and environment files from Issues 2 and 3 must be configured.
Copy `apps/gateway/.env.example` to `apps/gateway/.env` if it does not already exist.
Gateway `USER_QUEUE` and `CATALOG_QUEUE` must match each service's `RABBITMQ_QUEUE`.

In separate terminals, start:

```bash
npm run start:user-service
npm run start:catalog-service
npm run start:gateway
```

The old monolith also defaults to port 3000, so stop it before starting the gateway
or choose a different gateway `PORT`. `HOST` defaults to `0.0.0.0`.
RabbitMQ needs consumers on `user_queue` and `catalog_queue`; the gateway consumes
replies through Nest's reply mechanism, not either service's request queue.

## Existing HTTP routes

| HTTP request                            | Service pattern              | Success status |
| --------------------------------------- | ---------------------------- | -------------- |
| `POST /auth/register`                   | `user.register`              | 201            |
| `POST /auth/login`                      | `user.login`                 | 201            |
| `GET /users`                            | `user.findAll`               | 200            |
| `GET /laptops`                          | `catalog.laptops.findAll`    | 200            |
| `GET /laptops/:id`                      | `catalog.laptops.findOne`    | 200            |
| `POST /laptops`                         | `catalog.laptops.create`     | 201            |
| `PATCH /laptops/:id`                    | `catalog.laptops.update`     | 200            |
| `DELETE /laptops/:id`                   | `catalog.laptops.delete`     | 200            |
| `GET /shops`                            | `catalog.shops.findAll`      | 200            |
| `POST /shops`                           | `catalog.shops.create`       | 201            |
| `POST /shops/:shopId/laptops/:laptopId` | `catalog.shops.addLaptop`    | 201            |
| `GET /shops/laptop/:laptopId`           | `catalog.shops.findByLaptop` | 200            |

Request bodies and query parameters keep their existing HTTP shape. The gateway
builds the internal message envelopes, so clients do not put tokens in JSON.
Send `Authorization: Bearer <JWT>` for the admin user list and laptop mutations.
Services verify the forwarded token and enforce roles and ownership. Reads and
shop operations retain their current public access.

The gateway validates request bodies, IDs, and queries; services also validate
their messages. Unknown JSON properties (including spoofed user IDs and roles)
are rejected. Response wrapping happens exactly once:

```json
{ "success": true, "data": {}, "timestamp": "2026-09-07T00:00:00.000Z" }
```

Errors keep the original filter's shape:

```json
{ "success": false, "message": "Invalid credentials", "statusCode": 401 }
```

Service errors map to HTTP 400, 401, 403, 404, 409, or 500 as appropriate.
Unexpected internal details are sanitized. Connection failures map to 503; a
service that does not reply within five seconds produces 504. Outgoing messages
also carry a five-second RabbitMQ expiry. There are no application-level retries.
A timeout does not roll back or cancel a write already delivered to a service.

## HTTP security and caching

Helmet and CORS are enabled at the gateway. The existing Nest rate limiter allows
10 requests per IP per route handler per 60 seconds. Login retains the code's
stricter 3 requests per 6 seconds (the old README incorrectly stated 60 seconds).
Rate-limit storage is in memory per gateway instance. Proxy headers are not
trusted for identifying callers; configure a trusted proxy deliberately if one
is introduced later.

The gateway does not cache. Catalog continues caching only laptop lists for
60 seconds, without invalidation on writes. Password hashes remain excluded by
user-service, as documented in Issue 2.

## Try it

```bash
curl http://localhost:3000/laptops

curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"gateway_demo","password":"demo_password_123"}'

curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"gateway_demo","password":"demo_password_123"}'
```

The login JWT is at `data.access_token`, matching the original global interceptor.

## Verify

Run `npm run test:gateway:e2e` with the infrastructure running. It builds all three
apps, starts isolated service processes and an HTTP gateway on an available port,
and uses both curl and HTTP requests to exercise the complete round trips.

It checks every route, response wrapping, JWT forwarding, ownership and admin
access, validation, CORS/Helmet, rate limiting, five-second timeouts, no automatic
write retries, and broker failures. Temporary databases, RabbitMQ queues, and
Redis prefixes are cleaned up; development data is not cleared. This verifies
Issue 4. The README-wide functionality audit remains Issue 5.
