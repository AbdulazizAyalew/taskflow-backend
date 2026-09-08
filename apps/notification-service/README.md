# Notification service

This standalone Nest application consumes `laptop_created` events from RabbitMQ.
It has no HTTP listener and no database. Catalog-service emits the event after a
laptop is saved, while the gateway request returns without waiting for a
notification reply.

## Run from the repository root

1. Start RabbitMQ with `docker compose up -d rabbitmq`.
2. Copy `.env.example` to `.env` in this directory if `.env` does not exist.
3. Run `npm run start:notification-service`.
4. Confirm `notification_queue` has one consumer in the RabbitMQ management UI.

The service binds durable `notification_queue` to the topic exchange
`catalog_events_exchange` with routing key `laptop_created`. Its
`@EventPattern('laptop_created')` handler logs a simulated notification and then
manually acknowledges the delivery.

## Failure handling

A failed event is published to `notification_retry_exchange` before the original
delivery is acknowledged. `notification_retry_queue` holds it using a per-message
TTL and routes it back to `catalog_events_exchange` when the delay expires. There
are three total attempts, with default delays of 500 ms and 1000 ms. The
`x-retry-attempt` header records the count.

After the third failure, the service publishes the event to
`notification_dead_letter_exchange` with routing key `notification.dead`.
`notification_dead_letter_queue` retains it for inspection. If publishing the
retry or dead letter fails, the original message is negatively acknowledged with
requeue enabled instead of being silently removed.

Queue names, exchange names, maximum attempts, and the base retry delay are
configurable in `.env`. Run `npm run test:notification-service:e2e` to verify a
successful event and a forced failure progressing through both exponential
delays into the DLQ.
