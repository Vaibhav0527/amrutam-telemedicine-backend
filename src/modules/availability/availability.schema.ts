import { z } from 'zod';

export const createSlotsSchema = z.object({
  slots: z.array(
    z.object({
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
    })
  ).min(1, 'At least one slot is required'),
});

export const getSlotsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'BOOKED']).optional(),
});
