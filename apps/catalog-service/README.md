# Catalog service

Catalog owns laptops and shops in `taskflow_catalog`, independently of the users
DB. It consumes `catalog_queue` over RabbitMQ and exposes no HTTP listener. The
old monolith remains available as a migration reference; catalog imports none of
its code. Gateway routes forward HTTP requests to this service.

## Start from the repository root

1. Run `docker compose up -d postgres rabbitmq redis`.
2. Create the catalog database once, if not already created:
   `docker compose exec postgres createdb -U postgres taskflow_catalog`.
3. Copy `apps/catalog-service/.env.example` to `apps/catalog-service/.env` only if
   the latter does not exist. Set `JWT_SECRET` to the same secret as user-service.
4. Run `npm run start:catalog-service`.
5. In RabbitMQ's management UI at http://localhost:15672, confirm `catalog_queue`
   has one active consumer. The services can run at the same time.

The local database connection uses port 5434, RabbitMQ 5672, and Redis 6379.
`DB_SYNCHRONIZE=true` creates the tables locally. Use explicit migrations before
production deployment. The environment file is ignored by Git.

## Message contracts for the gateway

Use `ClientProxy.send(pattern, payload)` with a five-second timeout. Do not retry
writes automatically. JWTs are sent as raw strings without the `Bearer ` prefix.
Success replies are plain data, ready for the gateway's existing response wrapper.
Errors use `{ success: false, statusCode, message }`, matching user-service.

| Pattern                      | Payload                                                                    | Reply                                               |
| ---------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| `catalog.laptops.findAll`    | `{ page?, limit?, sort?, order?, brand?, minPrice?, maxPrice? }`           | `{ items, meta: { total, page, limit, lastPage } }` |
| `catalog.laptops.findOne`    | `{ id }`                                                                   | Laptop                                              |
| `catalog.laptops.create`     | `{ token, laptop: { description, brand, ram, price } }`                    | Created laptop                                      |
| `catalog.laptops.update`     | `{ token, id, laptop: { description?, brand?, ram?, price? } }`            | Updated laptop                                      |
| `catalog.laptops.delete`     | `{ token, id }`                                                            | Removed laptop, as returned by TypeORM              |
| `catalog.shops.findAll`      | `{}`                                                                       | Shops with inventory; 404 if empty                  |
| `catalog.shops.create`       | `{ shop: { name, location }, laptop: { description, brand, ram, price } }` | Existing success message                            |
| `catalog.shops.addLaptop`    | `{ shopId, laptopId }`                                                     | Shop with linked laptops                            |
| `catalog.shops.findByLaptop` | `{ laptopId }`                                                             | Matching shops; 404 if none                         |

Pagination defaults to page 1 and limit 10. Sort supports laptop columns `id`,
`description`, `brand`, `ram`, `price`, and `userId`, defaulting to ascending ID.
Query and ID strings are converted to numbers. Invalid IDs, pagination, sorting,
price ranges, and unexpected payload properties return 400. Laptop descriptions
require at least 10 characters, and RAM and prices must be positive integers.

## Authentication and ownership

`JwtStrategy` verifies HS256 signatures, expiry, numeric positive subjects, and
known roles locally. `JwtAuthGuard` places verified identity in the server-side
RabbitMQ context; caller-supplied user or role fields cannot substitute for it.
The strategy is transport-aware and does not depend on HTTP Passport extraction.

Laptop creation always takes `userId` from the verified JWT. Updates remain
owner-only, **including for admins**, as agreed. Deletion allows the owner or an
admin. Laptop reads stay public. There is no `User` entity or cross-database
foreign key: owner IDs are nullable integer references to external identities.
No user-service call is needed to authorize an operation. Previously issued JWTs
remain usable until expiry even if the account changes in user-service.

Shop operations remain public, matching the existing controllers. Public shop
creation assigns no owner to the shop or its initial laptop. The migration does
not introduce new shop ownership rules. Initial inventory and shop creation run
inside one local PostgreSQL transaction and roll back together on failure.

## Cache and notifications

Only laptop **list** results are cached. Redis keys include the database and
normalized pagination, sorting, and filters. TTL is exactly 60 seconds; writes do
not invalidate cached lists. Single-laptop and shop reads are always fresh. A
cache failure falls back to a PostgreSQL read.

Bull uses Redis and the `notifications` queue with prefix `catalog`. The prefix
keeps its jobs separate from the old monolith worker. After a laptop is linked,
a `laptop-linked` job processes in the background, preserving the existing
simulated two-second notification. Failed jobs get three total attempts with
exponential backoff starting at five seconds. Re-linking an existing laptop
returns the relationship without creating duplicate inventory or a second job.
Existing jobs in the old monolith's Bull namespace are not migrated.

The link is saved before the Bull notification is enqueued, as before. This is
not an atomic database-plus-queue transaction; an outbox would be needed to
guarantee delivery across that failure window.

RabbitMQ routes catalog patterns through the durable direct exchange
`catalog_exchange` into `catalog_queue`. The consumer uses manual acknowledgments:
successful handlers and expected 4xx results are acknowledged, while unexpected
5xx failures are rejected into `catalog_dead_letter_queue`. An unacknowledged
delivery is redelivered if the consumer connection closes.

Creating a laptop also emits the fire-and-forget `laptop_created` event to
`catalog_events_exchange`; it does not wait for notification-service to reply.
This publication happens after the database save, so an outbox would still be
needed for atomic database-and-event delivery. A gateway timeout cannot cancel a
write that is already executing.

## Verify

Run `npm run test:catalog-service:e2e`. This starts a separate compiled catalog
process with a uniquely named temporary PostgreSQL database, RabbitMQ queue, and
Redis prefixes. It tests real ownership checks, JWT verification, CRUD, query
filtering, cache TTL/staleness, transaction rollback, and Bull job completion.
Only its own test data is cleaned up. Development records, queues, and Redis keys
are not cleared. The local PostgreSQL credentials need database creation rights.
