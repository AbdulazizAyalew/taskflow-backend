import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  HOST: Joi.string().default('0.0.0.0'),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  USER_QUEUE: Joi.string().default('user_queue'),
  CATALOG_QUEUE: Joi.string().default('catalog_queue'),
});
