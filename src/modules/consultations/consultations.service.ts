import { prisma } from '../../database/prisma';
import { activeConsultationsGauge } from '../../observability/metrics';
import { auditService } from '../audit/audit.service';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors';

export class ConsultationService {
  async listUserConsultations(userId: string, role: string, status?: any) {
    const where: any = {};

    if (role === 'PATIENT') {
      where.patientId = userId;
    } else if (role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) throw new NotFoundError('Doctor profile not found');
      where.doctorId = doctor.id;
    }

    if (status) {
      where.status = status;
    }

    return prisma.consultation.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      include: {
        doctor: {
          include: {
            user: { select: { profile: true } },
          },
        },
        patient: {
          select: { id: true, email: true, profile: true },
        },
        slot: true,
        payment: true,
        prescription: true,
      },
    });
  }

  async getConsultationById(id: string, userId: string, role: string) {
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        doctor: {
          include: {
            user: { select: { profile: true } },
          },
        },
        patient: {
          select: { id: true, email: true, profile: true },
        },
        slot: true,
        payment: true,
        prescription: true,
      },
    });

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // Verify participant ownership (BOLA defense)
    if (role !== 'ADMIN') {
      const isPatient = consultation.patientId === userId;
      const isDoctor = consultation.doctor.userId === userId;
      if (!isPatient && !isDoctor) {
        throw new ForbiddenError('You are not authorized to view this consultation');
      }
    }

    return consultation;
  }

  async updateConsultationStatus(params: {
    consultationId: string;
    newStatus: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    userId: string;
    role: string;
    cancellationReason?: string;
    ipAddress?: string;
  }) {
    const { consultationId, newStatus, userId, role, cancellationReason, ipAddress } = params;

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { doctor: true },
    });

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // Authorization: only the assigned doctor or admin can change status
    if (role !== 'ADMIN' && consultation.doctor.userId !== userId) {
      throw new ForbiddenError('Only the assigned doctor or admin can modify consultation status');
    }

    const previousStatus = consultation.status;

    // Validate lifecycle transitions
    if (previousStatus === 'COMPLETED' || previousStatus === 'CANCELLED') {
      throw new BadRequestError(`Cannot transition from finalized status '${previousStatus}'`);
    }

    const updateData: any = { status: newStatus };

    if (newStatus === 'IN_PROGRESS' && !consultation.startedAt) {
      updateData.startedAt = new Date();
      activeConsultationsGauge.inc();
    } else if (newStatus === 'COMPLETED') {
      updateData.endedAt = new Date();
      if (previousStatus === 'IN_PROGRESS') {
        activeConsultationsGauge.dec();
      }
    } else if (newStatus === 'CANCELLED') {
      updateData.cancellationReason = cancellationReason;
      if (previousStatus === 'IN_PROGRESS') {
        activeConsultationsGauge.dec();
      }
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: updateData,
    });

    await auditService.log({
      userId,
      action: `CONSULTATION_STATUS_${newStatus}`,
      resourceType: 'CONSULTATION',
      resourceId: consultationId,
      previousState: { status: previousStatus },
      newState: { status: newStatus },
      ipAddress,
    });

    return updated;
  }
}

export const consultationService = new ConsultationService();
