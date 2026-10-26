import { Request, Response, NextFunction } from 'express';
import { doctorService } from './doctors.service';
import { sendSuccess } from '../../common/response';

export class DoctorController {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await doctorService.searchDoctors(req.query as any);
      sendSuccess(res, result.doctors, 'Doctors retrieved successfully', 200, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const doctor = await doctorService.getDoctorById(req.params.id as string);
      sendSuccess(res, doctor, 'Doctor profile retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}

export const doctorController = new DoctorController();
