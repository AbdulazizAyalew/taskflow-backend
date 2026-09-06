import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // App
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().required(),
  
  // DB
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
});