import { prisma } from '../../database/prisma';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { auditService } from '../audit/audit.service';

export interface CreateSlotItem {
  startTime: string;
  endTime: string;
}

export class AvailabilityService {
  async createSlots(
    doctorId: string,
    slots: CreateSlotItem[],
    userId: string,
    ipAddress?: string
  ) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // Prepare slots data and check for overlaps
    const createdSlots = await prisma.$transaction(async (tx) => {
      const records = [];

      for (const slot of slots) {
        const start = new Date(slot.startTime);
        const end = new Date(slot.endTime);

        if (end <= start) {
          throw new BadRequestError(`Slot end time must be after start time: ${slot.startTime}`);
        }

        // Check if an overlapping slot already exists for this doctor
        const overlap = await tx.availabilitySlot.findFirst({
          where: {
            doctorId,
            status: { not: 'CANCELLED' },
            OR: [
              {
                AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }],
              },
              {
                AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }],
              },
            ],
          },
        });

        if (overlap) {
          throw new BadRequestError(
            `Slot overlapping with existing slot (${overlap.startTime.toISOString()} - ${overlap.endTime.toISOString()})`
          );
        }

        const created = await tx.availabilitySlot.create({
          data: {
            doctorId,
            startTime: start,
            endTime: end,
            status: 'AVAILABLE',
          },
        });

        records.push(created);
      }

      return records;
    });

    await auditService.log({
      userId,
      action: 'SLOTS_CREATED',
      resourceType: 'AVAILABILITY_SLOT',
      newState: { doctorId, slotCount: createdSlots.length },
      ipAddress,
    });

    return createdSlots;
  }

  async getDoctorSlots(
    doctorId: string,
    filters: {
      startDate?: string;
      endDate?: string;
      status?: 'AVAILABLE' | 'RESERVED' | 'BOOKED';
    }
  ) {
    const where: any = { doctorId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = new Date(filters.startDate);
      if (filters.endDate) where.startTime.lte = new Date(filters.endDate);
    } else {
      // Default: from now onwards
      where.startTime = { gte: new Date() };
    }

    return prisma.availabilitySlot.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });
  }
}

export const availabilityService = new AvailabilityService();
