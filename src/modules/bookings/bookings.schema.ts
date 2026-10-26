import { z } from 'zod';

export const createBookingSchema = z.object({
  slotId: z.string().uuid('Valid slot ID required'),
  doctorId: z.string().uuid('Valid doctor ID required'),
  patientNotes: z.string().max(500).optional(),
});
