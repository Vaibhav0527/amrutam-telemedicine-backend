import { Router } from 'express';
import { doctorController } from './doctors.controller';
import { validateRequest } from '../../middlewares/validate';
import { doctorSearchSchema } from './doctors.schema';

const router = Router();

router.get(
  '/',
  validateRequest({ query: doctorSearchSchema }),
  doctorController.search
);

router.get('/:id', doctorController.getById);

export const doctorRoutes = router;
