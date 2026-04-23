import { body } from 'express-validator';

export const authenticateValidator = [
  body('email')
    .isEmail()
    .withMessage('بريد إلكتروني غير صالح'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('يجب أن تكون كلمة المرور 8 أحرف على الأقل'),
];

export const registerValidator = [
  body('email')
    .isEmail()
    .withMessage('بريد إلكتروني غير صالح'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('يجب أن تكون كلمة المرور 8 أحرف على الأقل')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل، وحرف صغير واحد، ورقم'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('الاسم الأول مطلوب')
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون الاسم الأول أقل من 50 حرفًا'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('الاسم الأخير مطلوب')
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون الاسم الأخير أقل من 50 حرفًا'),
];

export const forgotPasswordValidator = [
  body('email')
    .isEmail()
    .withMessage('بريد إلكتروني غير صالح'),
];

export const resetPasswordValidator = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('رمز إعادة التعيين مطلوب'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('يجب أن تكون كلمة المرور 8 أحرف على الأقل')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل، وحرف صغير واحد، ورقم'),
];

export const changePasswordValidator = [
  body('oldPassword')
    .trim()
    .notEmpty()
    .withMessage('كلمة المرور القديمة مطلوبة'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('يجب أن تكون كلمة المرور 8 أحرف على الأقل')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل، وحرف صغير واحد، ورقم'),
];
