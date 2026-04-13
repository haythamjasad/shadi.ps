import { Router } from "express";
import { TransactionController } from "../controllers/transaction.controller";
import { validate } from "../middlewares/validate";
import { authenticateAdminAccess, requireAdminPermission } from "../middlewares/adminAccess";
import { apiRateLimiter } from "../middlewares/rateLimiter";
import {
  updateTransactionValidator,
  idParamValidator,
} from "../validators/transaction.validators";

const router = Router();

// All routes require authentication
router.use(authenticateAdminAccess);
router.use(apiRateLimiter);

// POST /api/v0/transactions/:id
router.post(
  "/:id",
  requireAdminPermission('shadi_transactions', 'update'),
  validate(updateTransactionValidator),
  TransactionController.update
);

// GET /api/v0/transactions/open
router.get("/open", requireAdminPermission('shadi_transactions', 'read_list'), TransactionController.findAllOpen);

// GET /api/v0/transactions/new
router.get("/new", requireAdminPermission('shadi_transactions', 'read_list'), TransactionController.findAllNew);

// GET /api/v0/transactions/closed
router.get("/closed", requireAdminPermission('shadi_transactions', 'read_list'), TransactionController.findAllClosed);

// GET /api/v0/transactions/init
router.get("/init", requireAdminPermission('shadi_transactions', 'read_list'), TransactionController.findAllInit);

// GET /api/v0/transactions/charge
router.get("/charge", requireAdminPermission('shadi_transactions', 'read_list'), TransactionController.findAllCharge);

// GET /api/v0/transactions/status/:status
router.get("/status/:status", requireAdminPermission('shadi_transactions', 'read_list'), TransactionController.findAllByStatus);

// DELETE /api/v0/transactions/:id (Admin only)
router.delete(
  "/:id",
  requireAdminPermission('shadi_transactions', 'delete'),
  validate(idParamValidator),
  TransactionController.delete
);

export default router;
