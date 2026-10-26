import { z } from 'zod';

export const createPrescriptionSchema = z.object({
  diagnosis: z.string().min(3, 'Diagnosis description is required'),
  medicinesDosage: z
    .array(
      z.object({
        name: z.string().min(1, 'Medicine name is required'),
        dosage: z.string().min(1, 'Dosage instructions are required'),
        timing: z.string().min(1, 'Timing is required'),
        duration: z.string().min(1, 'Duration is required'),
      })
    )
    .min(1, 'At least one Ayurvedic medicine must be prescribed'),
  dietaryLifestyleAdvice: z.string().optional(),
  privateClinicalNotes: z.string().optional(), // Will be encrypted with AES-256-GCM
});
