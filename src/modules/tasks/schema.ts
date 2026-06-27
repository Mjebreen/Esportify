import { z } from 'zod';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const;
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(4000).nullish(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeUserId: z.string().uuid().nullish(),
  dueDate: z.coerce.date().nullish(),
});

export const taskUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(4000).nullish(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeUserId: z.string().uuid().nullish(),
  dueDate: z.coerce.date().nullish(),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
