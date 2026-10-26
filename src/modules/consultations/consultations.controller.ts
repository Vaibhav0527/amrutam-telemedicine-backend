import { Request, Response, NextFunction } from 'express';
import { consultationService } from './consultations.service';
import { sendSuccess } from '../../common/response';

export class ConsultationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const results = await consultationService.listUserConsultations(
        req.user!.id,
        req.user!.role,
        req.query.status
      );
      sendSuccess(res, results, 'Consultations retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await consultationService.getConsultationById(
        req.params.id as string,
        req.user!.id,
        req.user!.role
      );
      sendSuccess(res, result, 'Consultation details retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await consultationService.updateConsultationStatus({
        consultationId: req.params.id as string,
        newStatus: req.body.status,
        userId: req.user!.id,
        role: req.user!.role,
        cancellationReason: req.body.cancellationReason,
        ipAddress: req.ip,
      });
      sendSuccess(res, result, `Consultation marked as ${req.body.status}`, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const consultationController = new ConsultationController();
