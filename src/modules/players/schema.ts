import { z } from 'zod';

export const playerCreateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  inGameName: z.string().min(1, 'In-game name is required').max(60),
  rosterId: z.string().uuid().nullish(),
  email: z.string().email().nullish(),
  phone: z.string().max(40).nullish(),
  jerseyNumber: z.coerce.number().int().min(0).max(999).nullish(),
  status: z.enum(['ACTIVE', 'BENCHED', 'INACTIVE', 'TRIAL', 'FORMER']).optional(),
});

export const playerUpdateSchema = playerCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const playerDeleteSchema = z.object({ id: z.string().uuid() });

export type PlayerCreateInput = z.infer<typeof playerCreateSchema>;
export type PlayerUpdateInput = z.infer<typeof playerUpdateSchema>;
export type PlayerDeleteInput = z.infer<typeof playerDeleteSchema>;
