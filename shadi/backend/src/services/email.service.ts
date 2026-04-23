import nodemailer from 'nodemailer';
import { config } from '../config/env';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: true,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export class EmailService {
  static async sendPasswordResetEmail(
    email: string,
    resetToken: string
  ): Promise<void> {
    const resetUrl = `${config.baseUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: config.smtp.from,
      to: email,
      subject: 'طلب إعادة تعيين كلمة المرور',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif;">
          <h1>إعادة تعيين كلمة المرور</h1>
          <p>لقد طلبت إعادة تعيين كلمة المرور. انقر على الرابط أدناه لإعادة تعيين كلمة المرور الخاصة بك:</p>
          <a href="${resetUrl}" style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
          ">إعادة تعيين كلمة المرور</a>
          <p>سينتهي صلاحية هذا الرابط خلال ساعة واحدة.</p>
          <p>إذا لم تطلب ذلك، يرجى تجاهل هذا البريد الإلكتروني.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  static async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const mailOptions = {
      from: config.smtp.from,
      to: email,
      subject: 'Welcome to Our Platform',
      html: `
        <h1>Welcome, ${firstName}!</h1>
        <p>Thank you for registering with us.</p>
        <p>If you have any questions, feel free to reach out.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  static async sendEmail(email: string, subject: string, body: string): Promise<void> {
    const mailOptions = {
      from: config.smtp.from,
      to: email,
      subject: subject,
      html: body,
    };

    await transporter.sendMail(mailOptions);
  }
}
