import { prisma } from '../../database/prisma';

export class AnalyticsService {
  async getPlatformOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalDoctors,
      totalConsultations,
      todayConsultations,
      consultationsByStatus,
      revenueResult,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.doctor.count(),
      prisma.consultation.count(),
      prisma.consultation.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.consultation.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    const statusMap = consultationsByStatus.reduce((acc: any, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    const completed = statusMap['COMPLETED'] || 0;
    const cancelled = statusMap['CANCELLED'] || 0;
    const totalFinished = completed + cancelled;
    const cancellationRate = totalFinished > 0 ? ((cancelled / totalFinished) * 100).toFixed(2) : '0.00';

    return {
      users: {
        total: totalUsers,
        doctors: totalDoctors,
      },
      consultations: {
        totalAllTime: totalConsultations,
        todayCount: todayConsultations,
        statusBreakdown: statusMap,
        cancellationRatePercent: `${cancellationRate}%`,
      },
      financials: {
        totalRevenue: revenueResult._sum.amount || 0,
        currency: 'INR',
      },
      scaleBenchmark: {
        dailyCapacityTarget: 100000,
        slaReadLatencyTargetP95: '< 200ms',
        slaWriteLatencyTargetP95: '< 500ms',
        availabilityTarget: '99.95%',
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
