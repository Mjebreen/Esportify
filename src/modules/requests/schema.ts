import { z } from 'zod';

export const REQUEST_TYPES = ['TECHNICAL_SERVICE', 'PHOTOGRAPHY', 'SPECIAL', 'TRAVEL', 'MERCH', 'GENERAL'] as const;
export const REQUEST_STATUSES = ['NEW', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as const;
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const requestCreateSchema = z.object({
  type: z.enum(REQUEST_TYPES),
  title: z.string().min(1).max(160),
  description: z.string().max(4000).nullish(),
  priority: z.enum(PRIORITIES).optional(),
  targetDepartmentId: z.string().uuid().nullish(),
  dueDate: z.coerce.date().nullish(),
});

export const requestUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(REQUEST_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeUserId: z.string().uuid().nullish(),
  targetDepartmentId: z.string().uuid().nullish(),
  dueDate: z.coerce.date().nullish(),
});

export const commentCreateSchema = z.object({
  requestId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  body: z.string().min(1).max(2000),
});

export type RequestCreateInput = z.infer<typeof requestCreateSchema>;
export type RequestUpdateInput = z.infer<typeof requestUpdateSchema>;
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
