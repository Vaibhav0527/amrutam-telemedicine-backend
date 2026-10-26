import { Request, Response, NextFunction } from 'express';
import { availabilityService } from './availability.service';
import { sendSuccess } from '../../common/response';
import { ForbiddenError } from '../../common/errors';
import { prisma } from '../../database/prisma';

export class AvailabilityController {
  async createSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const doctorId = req.params.doctorId as string;

      // Ensure doctor can only manage their own slots unless admin
      if (req.user!.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
          where: { userId: req.user!.id },
        });
        if (!doctor || doctor.id !== doctorId) {
          throw new ForbiddenError('You can only create slots for your own doctor profile');
        }
      }

      const slots = await availabilityService.createSlots(
        doctorId,
        req.body.slots,
        req.user!.id,
        req.ip
      );

      sendSuccess(res, slots, 'Availability slots created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async getSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const doctorId = req.params.doctorId as string;
      const slots = await availabilityService.getDoctorSlots(
        doctorId,
        req.query as any
      );
      sendSuccess(res, slots, 'Doctor availability slots retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
}

export const availabilityController = new AvailabilityController();
