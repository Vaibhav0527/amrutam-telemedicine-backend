import { Request, Response, NextFunction } from 'express';
import { prescriptionService } from './prescriptions.service';
import { sendSuccess } from '../../common/response';

export class PrescriptionController {
  async issue(req: Request, res: Response, next: NextFunction) {
    try {
      const consultationId = req.params.consultationId as string;
      const result = await prescriptionService.issuePrescription({
        consultationId,
        doctorId: req.user!.id,
        diagnosis: req.body.diagnosis,
        medicinesDosage: req.body.medicinesDosage,
        dietaryLifestyleAdvice: req.body.dietaryLifestyleAdvice,
        privateClinicalNotes: req.body.privateClinicalNotes,
        ipAddress: req.ip,
      });

      sendSuccess(res, result, 'Prescription issued and digitally signed', 201);
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const consultationId = req.params.consultationId as string;
      const result = await prescriptionService.getPrescription(
        consultationId,
        req.user!.id,
        req.user!.role
      );
      sendSuccess(res, result, 'Prescription retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}

export const prescriptionController = new PrescriptionController();
