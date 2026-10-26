import { prisma } from '../../database/prisma';
import { getRedisClient } from '../../cache/redis';
import { NotFoundError } from '../../common/errors';
import { z } from 'zod';
import { doctorSearchSchema } from './doctors.schema';

export type DoctorSearchParams = z.infer<typeof doctorSearchSchema>;

export class DoctorService {
  async searchDoctors(params: DoctorSearchParams) {
    const redis = getRedisClient();
    const cacheKey = `search:doctors:${JSON.stringify(params)}`;

    // Try L1 Redis Cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const { query, specialty, minExperience, maxFee, minRating, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      isAvailable: true,
    };

    if (specialty) {
      where.specialties = { has: specialty };
    }

    if (minExperience !== undefined) {
      where.yearsOfExperience = { gte: minExperience };
    }

    if (maxFee !== undefined) {
      where.consultationFee = { lte: maxFee };
    }

    if (minRating !== undefined) {
      where.rating = { gte: minRating };
    }

    if (query) {
      where.OR = [
        { user: { profile: { firstName: { contains: query, mode: 'insensitive' } } } },
        { user: { profile: { lastName: { contains: query, mode: 'insensitive' } } } },
        { bio: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              profile: true,
            },
          },
        },
      }),
      prisma.doctor.count({ where }),
    ]);

    const result = {
      doctors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache in Redis for 3 minutes
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 180);

    return result;
  }

  async getDoctorById(id: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        availabilitySlots: {
          where: {
            status: 'AVAILABLE',
            startTime: { gte: new Date() },
          },
          orderBy: { startTime: 'asc' },
          take: 20,
        },
      },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    return doctor;
  }
}

export const doctorService = new DoctorService();
