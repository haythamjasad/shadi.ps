import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import { config } from '../config/env';
import { AppError } from '../utils/AppError';
import { EmailService } from './email.service';

const userRepository = AppDataSource.getRepository(User);

export class AuthService {
  static async authenticate(
    email: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.activated) {
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVATED', 'Account is not activated');
    }

    const token = this.generateToken(user);

    return { user, token };
  }

  static generateToken(user: User): string {
    const payload = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: [user.role],
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '12h',
      algorithm: 'HS256',
    });
  }

  static async forgotPassword(email: string): Promise<void> {
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await userRepository.save(user);

    await EmailService.sendPasswordResetEmail(email, resetToken);
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await userRepository.findOne({
      where: { resetToken: token },
    });

    if (!user) {
      throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired reset token');
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new AppError(400, 'TOKEN_EXPIRED', 'Reset token has expired');
    }

    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await userRepository.save(user);
  }

  static async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findOne({
      where: { id: id },
    });

    if (!user) {
      throw new AppError(400, 'USER_NOT_FOUND', 'User not found');
    }

    if (!user.password || !(await user.comparePassword(oldPassword))) {
      throw new AppError(400, 'INVALID_OLD_PASSWORD', 'Old password is incorrect');
    }

    if (newPassword.length < 6) {
      throw new AppError(400, 'WEAK_PASSWORD', 'New password must be at least 6 characters');
    }

    user.password = newPassword;
    await userRepository.save(user);
  }

  static async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<User> {
    const existingUser = await userRepository.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
    }

    const user = userRepository.create({
      ...userData,
      role: UserRole.USER,
      activated: true, // Set to false if email verification is required
    });

    return userRepository.save(user);
  }
}
