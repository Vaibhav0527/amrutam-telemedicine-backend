import { prisma } from '../../database/prisma';
import {
  acquireDistributedLock,
  releaseDistributedLock,
} from '../../cache/redis';
import { bookingConflictsCounter } from '../../observability/metrics';
import { auditService } from '../audit/audit.service';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../common/errors';
import { logger } from '../../observability/logger';

export class BookingService {
  async reserveSlotAndCreateBooking(params: {
    patientId: string;
    doctorId: string;
    slotId: string;
    idempotencyKey?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { patientId, doctorId, slotId, idempotencyKey, ipAddress, userAgent } = params;

    // Verify doctor exists
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    const lockKey = `lock:slot:${slotId}`;
    const acquired = await acquireDistributedLock(lockKey, 10);

    if (!acquired) {
      bookingConflictsCounter.inc();
      logger.warn({ slotId, patientId }, 'Concurrency lock conflict rejected (Tier 1 Redis Lock)');
      throw new ConflictError(
        'This slot is currently being reserved by another user. Please choose another slot or try again in a few moments.'
      );
    }

    try {
      // Step 2: Database Transaction with Pessimistic Lock check
      const result = await prisma.$transaction(async (tx) => {
        // Find slot
        const slot = await tx.availabilitySlot.findUnique({
          where: { id: slotId },
        });

        if (!slot) {
          throw new NotFoundError('Availability slot not found');
        }

        if (slot.doctorId !== doctorId) {
          throw new BadRequestError('Slot does not belong to specified doctor');
        }

        const now = new Date();

        // Check if slot is available
        const isCurrentlyHeld =
          slot.status === 'RESERVED' &&
          slot.lockedUntil &&
          new Date(slot.lockedUntil) > now &&
          slot.lockedByUserId !== patientId;

        if (slot.status === 'BOOKED' || isCurrentlyHeld) {
          bookingConflictsCounter.inc();
          throw new ConflictError('Slot is already reserved or booked by another patient');
        }

        if (new Date(slot.startTime) <= now) {
          throw new BadRequestError('Cannot book a slot in the past');
        }

        // Hold slot for 10 minutes
        const holdExpiration = new Date(Date.now() + 10 * 60 * 1000);

        await tx.availabilitySlot.update({
          where: { id: slotId },
          data: {
            status: 'RESERVED',
            lockedUntil: holdExpiration,
            lockedByUserId: patientId,
          },
        });

        // Generate unique consultation reference number
        const consultationNumber = `AMR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create Consultation with PENDING_PAYMENT status
        const consultation = await tx.consultation.create({
          data: {
            consultationNumber,
            patientId,
            doctorId,
            slotId,
            status: 'PENDING_PAYMENT',
            scheduledAt: slot.startTime,
          },
          include: {
            doctor: {
              include: {
                user: {
                  select: { profile: true },
                },
              },
            },
            slot: true,
          },
        });

        // Initialize Payment Record
        const payment = await tx.payment.create({
          data: {
            consultationId: consultation.id,
            amount: doctor.consultationFee,
            currency: 'INR',
            status: 'INITIATED',
            idempotencyKey,
            gatewayOrderId: `order_${consultation.consultationNumber}`,
          },
        });

        return { consultation, payment, holdExpiresAt: holdExpiration };
      });

      // Audit log entry
      await auditService.log({
        userId: patientId,
        action: 'CONSULTATION_RESERVED',
        resourceType: 'CONSULTATION',
        resourceId: result.consultation.id,
        newState: {
          consultationNumber: result.consultation.consultationNumber,
          slotId,
          doctorId,
          amount: result.payment.amount,
        },
        ipAddress,
        userAgent,
      });

      return result;
    } finally {
      // Release distributed lock
      await releaseDistributedLock(lockKey);
    }
  }

  async getBookingStatus(consultationId: string, userId: string) {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        slot: true,
        payment: true,
        doctor: {
          include: {
            user: { select: { profile: true } },
          },
        },
      },
    });

    if (!consultation) {
      throw new NotFoundError('Booking consultation not found');
    }

    return consultation;
  }
}

export const bookingService = new BookingService();
