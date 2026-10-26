import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(8, 'Password must be at least 8 characters with letters and numbers'),
  role: z.enum(['PATIENT', 'DOCTOR', 'ADMIN']).default('PATIENT'),
  profile: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    dateOfBirth: z.string().optional(),
    address: z.string().optional(),
    emergencyContact: z.string().optional(),
  }),
  doctorDetails: z
    .object({
      licenseNumber: z.string().min(3),
      specialties: z.array(z.string()).default(['General Ayurveda']),
      yearsOfExperience: z.number().int().min(0).default(1),
      consultationFee: z.number().positive().default(500),
      bio: z.string().optional(),
    })
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  mfaToken: z.string().length(6).optional(),
});

export const mfaVerifySchema = z.object({
  mfaToken: z.string().length(6),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});
