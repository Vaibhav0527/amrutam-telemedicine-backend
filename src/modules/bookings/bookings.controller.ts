import { Request, Response, NextFunction } from 'express';
import { bookingService } from './bookings.service';
import { sendSuccess } from '../../common/response';

export class BookingController {
  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

      const result = await bookingService.reserveSlotAndCreateBooking({
        patientId: req.user!.id,
        doctorId: req.body.doctorId,
        slotId: req.body.slotId,
        idempotencyKey,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(
        res,
        result,
        'Slot reserved successfully. Please complete payment within 10 minutes to confirm.',
        201
      );
    } catch (err) {
      next(err);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.getBookingStatus(
        req.params.id as string,
        req.user!.id
      );
      sendSuccess(res, result, 'Booking status retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
}

export const bookingController = new BookingController();
