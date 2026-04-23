import { Router } from 'express';
import { JoinUsController } from '../controllers/joinUs.controller';
import { validate } from '../middlewares/validate';
import { authenticateAdminAccess, requireAdminPermission } from '../middlewares/adminAccess';
import { apiRateLimiter } from '../middlewares/rateLimiter';
import {
  createJoinUsValidator,
  updateJoinUsValidator,
  idParamValidator,
} from '../validators/joinUs.validators';

const router = Router();

// All routes require authentication
router.use(authenticateAdminAccess);
router.use(apiRateLimiter);

// PUT /api/v0/join-us/:id
router.put(
  '/:id',
  requireAdminPermission('shadi_join_requests', 'update'),
  validate(updateJoinUsValidator),
  JoinUsController.update
);

// GET /api/v0/join-us/:id
router.get(
  '/:id',
  requireAdminPermission('shadi_join_requests', 'read_list'),
  validate(idParamValidator),
  JoinUsController.findById
);

// GET /api/v0/join-us
router.get('/', requireAdminPermission('shadi_join_requests', 'read_list'), JoinUsController.findAll);

// DELETE /api/v0/join-us/:id (Admin only)
router.delete(
  '/:id',
  requireAdminPermission('shadi_join_requests', 'delete'),
  validate(idParamValidator),
  JoinUsController.delete
);

export default router;
