# User service — Issue 2

This standalone NestJS application owns users and authentication in the
`taskflow_users` PostgreSQL database. It consumes RabbitMQ messages on
`user_queue`; it does not expose HTTP routes. The old monolith is retained during
the staged migration because its catalog entities still reference its User entity.
The new service does not import any monolith code or access the catalog database.

## Run from the repository root

1. Start infrastructure: `docker compose up -d postgres rabbitmq`.
2. If needed, create the database once:
   `docker compose exec postgres createdb -U postgres taskflow_users`.
3. Copy `apps/user-service/.env.example` to `apps/user-service/.env` if the latter
   does not already exist. Set the shared JWT secret locally; never commit it.
4. Run `npm run start:user-service`.
5. Open http://localhost:15672 and check `user_queue` has an active consumer.

PostgreSQL is available to host processes on port 5434; RabbitMQ uses port 5672.
`DB_SYNCHRONIZE=true` is for local development. This automatically creates the
User table; use explicit migrations for production. The volume preserves data.
`RABBITMQ_QUEUE` optionally overrides the queue name.

## Message contract

Use Nest `ClientProxy.send(pattern, payload)` and await the reply with a five-second
timeout. Do not automatically retry writes. Successes are plain data; the future
gateway will apply the existing HTTP response wrapper and status codes once.

| Pattern         | Payload                                  | Reply                             |
| --------------- | ---------------------------------------- | --------------------------------- |
| `user.register` | `{ username, password }`                 | `{ id, username, role }`          |
| `user.login`    | `{ username, password }`                 | `{ access_token }`                |
| `user.findAll`  | `{ token }` (raw JWT, without `Bearer `) | Array of `{ id, username, role }` |

Registration always creates a regular user and hashes passwords with bcrypt
(10 rounds). DTO validation rejects extra properties, usernames shorter than four
characters, and passwords shorter than eight. Passwords and hashes are omitted
from replies (a deliberate correction to the old entity responses).

JWTs use HS256, contain numeric `sub`, `username`, and `role`, and expire in one
hour. The admin handler verifies the signature, expiry, subject and role locally;
caller-supplied role/user fields are not trusted. Account changes do not revoke
existing tokens immediately. Administrative role promotion remains a database
operation, as in the original app; there is no public promotion handler.

Errors cross RabbitMQ as `{ success: false, statusCode, message }`, with validation
400, invalid token/password 401, insufficient role 403, unknown login username 404
(preserved from the original app), duplicate username 409, and sanitized 500.
The gateway must translate these into HTTP errors in Issue 4.

Queue definitions are durable. Auto-acknowledgement is explicit (`noAck: true`):
a delivered request is not automatically redelivered if the service crashes.
This milestone does not guarantee processing or reply delivery across failures.
Durability of the queue alone does not guarantee message persistence. Revisit
manual acknowledgements together with write idempotency if reliable retries are
required; a client timeout does not cancel an already running write.

## Verification

With PostgreSQL and RabbitMQ running, run `npm run test:user-service:e2e`.
The test builds and starts a separate real service process using a uniquely named
temporary database and RabbitMQ queue. It checks registration, password hashing,
login, validation, duplicate requests, token expiry/signature, and admin access.
It deletes only its own test database and queue afterward; the configured database
and `user_queue` are not cleared. Test credentials need permission to create/drop
the temporary database (the local Docker `postgres` account has this permission).

`@nestjs/microservices` is pinned to 11.1.28 to match the installed Nest core;
update Nest framework packages together to avoid missing internal helpers.
