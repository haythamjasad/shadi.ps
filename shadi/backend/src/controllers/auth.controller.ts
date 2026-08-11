import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from '../utils/AppError';

export class AuthController {
  static async authenticate(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const { user, token } = await AuthService.authenticate(email, password);

      res.json({
        status: 200,
        message: 'Authentication successful',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, firstName, lastName } = req.body;
      const user = await AuthService.register({
        email,
        password,
        firstName,
        lastName,
      });

      res.status(201).json({
        status: 201,
        message: 'Registration successful',
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      await AuthService.forgotPassword(email);

      res.json({
        status: 200,
        message: 'إذا كان البريد الإلكتروني موجوداً، فقد تم إرسال رابط إعادة التعيين',
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      await AuthService.resetPassword(token, password);

      res.json({
        status: 200,
        message: 'Password reset successful',
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
      }

      const { oldPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user.id, oldPassword, newPassword);

      res.json({
        status: 200,
        message: 'Password change successful',
      });
    } catch (error) {
      next(error);
    }
  }
}
