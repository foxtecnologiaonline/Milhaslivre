// Environment validation & configuration
import { z } from 'zod';

const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Auth & Security
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('24h'),
  BCRYPT_ROUNDS: z.string().transform(Number).default('10'),

  // Twilio/WhatsApp
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Email (SendGrid)
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),

  // Payments (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Cache
  REDIS_URL: z.string().optional(),

  // Server
  ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Environment = z.infer<typeof EnvSchema>;

let config: Environment | null = null;

export function getConfig(): Environment {
  if (!config) {
    const parsed = EnvSchema.safeParse(process.env);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      console.error('❌ Invalid environment configuration:', errors);
      throw new Error('Invalid environment variables');
    }

    config = parsed.data;
  }

  return config;
}

export function isDev() {
  return getConfig().ENVIRONMENT === 'development';
}

export function isProd() {
  return getConfig().ENVIRONMENT === 'production';
}
