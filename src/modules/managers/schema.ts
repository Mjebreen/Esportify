import { z } from 'zod';

export const managerCreateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  email: z.string().email().nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
});

export const managerUpdateSchema = managerCreateSchema.partial().extend({ id: z.string().uuid() });
export const managerDeleteSchema = z.object({ id: z.string().uuid() });

export type ManagerCreateInput = z.infer<typeof managerCreateSchema>;
export type ManagerUpdateInput = z.infer<typeof managerUpdateSchema>;
export type ManagerDeleteInput = z.infer<typeof managerDeleteSchema>;
