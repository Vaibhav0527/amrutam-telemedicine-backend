import { z } from 'zod';

export const doctorSearchSchema = z.object({
  query: z.string().optional(),
  specialty: z.string().optional(),
  minExperience: z.coerce.number().min(0).optional(),
  maxFee: z.coerce.number().positive().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const updateDoctorProfileSchema = z.object({
  specialties: z.array(z.string()).optional(),
  yearsOfExperience: z.number().int().min(0).optional(),
  consultationFee: z.number().positive().optional(),
  bio: z.string().optional(),
  isAvailable: z.boolean().optional(),
});
