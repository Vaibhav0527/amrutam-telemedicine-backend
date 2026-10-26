import { prisma } from '../../database/prisma';
import { v4 as uuidv4 } from 'uuid';
import { auditService } from '../audit/audit.service';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../common/errors';
import { logger } from '../../observability/logger';

export class PaymentService {
  /**
   * Simulates/Processes payment confirmation (called by Webhook or client test)
   */
  async processPaymentConfirmation(params: {
    orderId: string;
    paymentId: string;
    signature?: string;
    ipAddress?: string;
  }) {
    const { orderId, paymentId, ipAddress } = params;

    const payment = await prisma.payment.findFirst({
      where: { gatewayOrderId: orderId },
      include: {
        consultation: {
          include: { slot: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError(`Payment record not found for order: ${orderId}`);
    }

    if (payment.status === 'COMPLETED') {
      logger.info({ orderId, paymentId }, 'Payment webhook already processed (Idempotent replay)');
      return { payment, alreadyProcessed: true };
    }

    // Atomically transition payment, consultation, and slot to confirmed states
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark payment COMPLETED
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          gatewayPaymentId: paymentId,
        },
      });

      // 2. Mark consultation SCHEDULED & assign video room ID
      const videoRoomId = `amrutam-room-${uuidv4()}`;
      const updatedConsultation = await tx.consultation.update({
        where: { id: payment.consultationId },
        data: {
          status: 'SCHEDULED',
          videoRoomId,
        },
      });

      // 3. Mark availability slot BOOKED
      await tx.availabilitySlot.update({
        where: { id: payment.consultation.slotId },
        data: {
          status: 'BOOKED',
          lockedUntil: null,
        },
      });

      return { payment: updatedPayment, consultation: updatedConsultation };
    });

    await auditService.log({
      userId: payment.consultation.patientId,
      action: 'PAYMENT_COMPLETED',
      resourceType: 'PAYMENT',
      resourceId: payment.id,
      newState: {
        paymentId,
        amount: payment.amount,
        consultationId: payment.consultationId,
        videoRoomId: result.consultation.videoRoomId,
      },
      ipAddress,
    });

    return { ...result, alreadyProcessed: false };
  }
}

export const paymentService = new PaymentService();
