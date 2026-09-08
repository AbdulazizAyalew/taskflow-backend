import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  RABBITMQ_QUEUE: Joi.string().default('notification_queue'),
  RABBITMQ_EVENT_EXCHANGE: Joi.string().default('catalog_events_exchange'),
});
