import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';
import { auditService } from '../audit/audit.service';
import { sendSuccess } from '../../common/response';

export class AnalyticsController {
  async getOverview(_req: Request, res: Response, next: NextFunction) {
    try {
      const overview = await analyticsService.getPlatformOverview();
      sendSuccess(res, overview, 'Admin platform analytics retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const action = req.query.action as string | undefined;
      const resourceType = req.query.resourceType as string | undefined;

      const result = await auditService.getAuditLogs({
        page,
        limit,
        action,
        resourceType,
      });

      sendSuccess(res, result.logs, 'Audit trail logs retrieved', 200, result.pagination);
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
