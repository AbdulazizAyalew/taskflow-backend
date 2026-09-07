# Issue 5 — Gateway functionality verification

Verified on September 7, 2026: **all 26 scenarios passed** (27 Node test results
including the parent test). All three apps built successfully. The integration
run took approximately 82 seconds, including the real cache-expiry wait, and its
cleanup completed successfully.

Run from the repository root, with PostgreSQL, RabbitMQ and Redis running:

```bash
npm run test:microservices:e2e
```

The suite builds and starts the real gateway, user-service, and catalog-service.
Every API request uses curl through the gateway. Registration, laptop creation,
and shop creation use JSON read directly from the README examples. Generated IDs
and login tokens replace the examples' placeholders. No services are mocked for
the functional checks; only the explicit failure tests use a non-replying consumer
or synthetic internal error to exercise gateway failure handling.

The test owns two temporary databases, two request queues, unique Redis prefixes,
and gateway ports assigned by the OS. It shuts down its processes and removes only
those resources afterward. It never clears development databases or Redis.

## Coverage of README examples and agreed behavior

| Area            | Assertions through the gateway                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Registration    | README payload succeeds; duplicate username is 409; invalid fields and role injection are 400; replies omit hashes                                                             |
| Login           | Real login returns `data.access_token`; wrong password is 401; unknown username retains 404                                                                                    |
| Admin user list | Missing token is 401; regular token is 403; an admin token returns the user list without password hashes                                                                       |
| Laptop list     | Public access, pagination shape, filtering, sorting, query validation, exact README Apple/price query                                                                          |
| Single laptop   | Returned ID and data, invalid ID is 400, missing/deleted record is 404                                                                                                         |
| Creation        | README payload succeeds and owner comes from the JWT; client-supplied `id`/`userId` is rejected                                                                                |
| Update          | Owner succeeds; bystander and non-owner admin receive 403                                                                                                                      |
| Deletion        | Owner and admin succeed; bystander receives 403                                                                                                                                |
| JWT checks      | Real forwarded tokens work; invalid, forged and expired tokens are rejected                                                                                                    |
| Shop creation   | README nested body creates the shop and initial laptop; validation and an induced database constraint failure leave neither partial record                                     |
| Inventory link  | Existing laptop is linked through the documented route; shop list and laptop lookup return the relationship                                                                    |
| Notifications   | HTTP link creates `laptop-linked`; Bull completes it; job has three total attempts and five-second exponential-backoff configuration                                           |
| Cache           | Redis entry TTL is 60 seconds; a write does not invalidate it; single-laptop reads are fresh; the list refreshes after a real 61-second wait                                   |
| HTTP contract   | Success/error wrappers occur once, original statuses, CORS, Helmet and hidden `X-Powered-By`                                                                                   |
| Rate limiting   | Per-route/IP limit and stricter login limit; spoofed proxy headers do not bypass it                                                                                            |
| Failures        | Offline catalog returns 504 around five seconds while users remain available; timed-out writes are sent once; broker errors become 503; private internal details are sanitized |

## Documentation corrections made during verification

These were mismatches between the old README and the agreed implementation, not
reasons to weaken validation or change ownership rules:

- The create-laptop example supplied an `id`, which the DTO has never accepted.
  The example now lets PostgreSQL generate it. A negative test keeps this rejection.
- Hardcoded resource IDs were replaced with placeholders. Examples must use IDs
  returned from their own create requests, and denied-delete checks must run before
  deleting the resource.
- Login's response is wrapped, so the token is at `data.access_token`.
- The Apple-filter response example incorrectly showed a Lenovo record.
- Admins can delete another user's laptop but cannot update it, as explicitly
  agreed. Shop routes remain public with nullable ownership.
- POST success statuses are 201, including login and inventory linking.
- Error bodies contain `success`, `message`, and `statusCode`; the old examples
  showed fields the actual filter does not emit.
- The existing login code uses three requests per six seconds, not per minute.
- Bull's `attempts: 3` means three total attempts, not three retries after the first.

No application behavior was changed for Issue 5. The Bull check verifies completion
and retry configuration; it does not inject a notification-provider failure. The
existing notification processor simulates work rather than contacting a provider.
Queue delivery guarantees and the database/enqueue failure window remain as
documented in the service READMEs.

The legacy monolith architecture/startup sections and Jest instructions are not the
microservices verification entry point. Their complete replacement belongs to
Issue 6; use the per-app run instructions and the command above for this milestone.
