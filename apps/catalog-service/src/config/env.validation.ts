import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5434),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(true),
  JWT_SECRET: Joi.string().required(),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  RABBITMQ_QUEUE: Joi.string().default('catalog_queue'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_DB: Joi.number().integer().min(0).default(0),
  CACHE_PREFIX: Joi.string().default('catalog'),
  BULL_PREFIX: Joi.string().default('catalog'),
});
