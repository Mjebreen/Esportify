import { z } from 'zod';

/**
 * Typed, validated environment. Importing this module throws early if config is
 * missing/malformed, so the app never boots into an insecure half-configured state.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  TEST_DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AWS_REGION: z.string().default('me-central-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_MEDIA_BUCKET: z.string().default('esportify-media-dev'),
  S3_PRESIGN_EXPIRY_SECONDS: z.coerce.number().int().positive().default(120),
  DEPLOYED_PHASE: z.coerce.number().int().min(1).max(4).default(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = schema.parse(process.env);

export type Env = z.infer<typeof schema>;
