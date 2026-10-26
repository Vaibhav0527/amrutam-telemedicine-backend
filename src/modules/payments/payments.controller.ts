import { Request, Response, NextFunction } from 'express';
import { paymentService } from './payments.service';
import { sendSuccess } from '../../common/response';

export class PaymentController {
  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, paymentId, signature } = req.body;

      const result = await paymentService.processPaymentConfirmation({
        orderId,
        paymentId,
        signature,
        ipAddress: req.ip,
      });

      sendSuccess(
        res,
        result,
        result.alreadyProcessed
          ? 'Webhook acknowledged (already processed)'
          : 'Payment verified and consultation scheduled',
        200
      );
    } catch (err) {
      next(err);
    }
  }
}

export const paymentController = new PaymentController();
