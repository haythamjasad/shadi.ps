import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { TransactionController } from '../controllers/transaction.controller';
import { JoinUsController } from '../controllers/joinUs.controller';
import { validate } from '../middlewares/validate';
import { authRateLimiter } from '../middlewares/rateLimiter';
import { authenticate } from '../middlewares/auth';
import {
  authenticateValidator,
  registerValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
} from '../validators/auth.validators';
import {
  createTransactionValidator,
  idParamValidator,
} from '../validators/transaction.validators';
import { createChargeTransactionValidator } from '../validators/chargeTransaction.validators';
import { createJoinUsValidator } from '../validators/joinUs.validators';

const router = Router();

// GET /api/v0/
router.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to ShadiPS API' });
});

// POST /api/v0/authenticate
router.post(
  '/authenticate',
  authRateLimiter,
  validate(authenticateValidator),
  AuthController.authenticate
);

// POST /api/v0/register
router.post(
  '/register',
  authRateLimiter,
  validate(registerValidator),
  AuthController.register
);

// POST /api/v0/forgot-password
router.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordValidator),
  AuthController.forgotPassword
);

// POST /api/v0/reset-password
router.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordValidator),
  AuthController.resetPassword
);

// POST /api/v0/change-password
router.post(
  '/change-password',
  authenticate,
  authRateLimiter,
  validate(changePasswordValidator),
  AuthController.changePassword
);

// POST /api/v0/transactions
router.post(
  '/transactions',
  validate(createTransactionValidator),
  TransactionController.create
);

// POST /api/v0/transactions
router.post(
  '/transactions/charge',
  validate(createChargeTransactionValidator),
  TransactionController.create
);

// POST /api/v0/transactions/verify-payment/:id
router.get(
  '/transactions/verify-payment/:id',
  TransactionController.verify
);

// POST /api/v0/join-us
router.post(
  '/join-us',
  validate(createJoinUsValidator),
  JoinUsController.create
);

router.get(
  '/transactions/get-one/:id',
  validate(idParamValidator),
  TransactionController.findById
);
export default router;
