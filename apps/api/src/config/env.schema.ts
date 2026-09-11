import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRY: z.string().default('24h'),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().int().positive().default(30),
  PAGARME_API_KEY: z.string().optional(),
  PAGARME_WEBHOOK_SECRET: z.string().optional(),
  MELHOR_ENVIO_TOKEN: z.string().optional(),
  SHIPPING_ORIGIN_ZIP_CODE: z.string().default('01310-100'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
