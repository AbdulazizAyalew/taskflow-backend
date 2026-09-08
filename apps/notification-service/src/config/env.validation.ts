import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  RABBITMQ_QUEUE: Joi.string().default('notification_queue'),
  RABBITMQ_EVENT_EXCHANGE: Joi.string().default('catalog_events_exchange'),
  RABBITMQ_RETRY_EXCHANGE: Joi.string().default('notification_retry_exchange'),
  RABBITMQ_RETRY_QUEUE: Joi.string().default('notification_retry_queue'),
  RABBITMQ_DLX: Joi.string().default('notification_dead_letter_exchange'),
  RABBITMQ_DLQ: Joi.string().default('notification_dead_letter_queue'),
  RABBITMQ_DLQ_ROUTING_KEY: Joi.string().default('notification.dead'),
  RABBITMQ_MAX_ATTEMPTS: Joi.number().integer().min(1).default(3),
  RABBITMQ_RETRY_BASE_DELAY_MS: Joi.number().integer().min(1).default(500),
});
