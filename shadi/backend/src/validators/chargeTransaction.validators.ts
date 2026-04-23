import { body } from 'express-validator';
import {  Location, ServiceType } from '../entities/Transaction';

const phoneRegex = /^\+?[\d\s\-()]{8,20}$/;

export const createChargeTransactionValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('الرجاء ادخال الاسم')
    .isLength({ max: 100 })
    .withMessage('يجب أن يكون الاسم أقل من 100 حرف'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('الرجاء ادخال رقم الهاتف')
    .matches(phoneRegex)
    .withMessage('يجب أن يكون رقم الهاتف رقمًا دوليًا صالحًا يبدأ بـ +'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('بريد إلكتروني غير صالح'),
  body('serviceType')
    .customSanitizer((value) => (Array.isArray(value) ? value : [value]))
    .custom((value) => (
      Array.isArray(value)
      && value.length === 1
      && value[0] === ServiceType.CHARGES
    ))
    .withMessage(`يجب أن تكون الخدمة ${ServiceType.CHARGES}`),
  body('location')
    .optional()
    .isIn(Object.values(Location))
    .withMessage(`يجب أن يكون الموقع واحدًا من: ${Object.values(Location).join(', ')}`),
  body('cost')
    .isFloat({ gt: 0 })
    .withMessage('يجب أن تكون التكلفة رقمًا أكبر من صفر'),
  body('notes')
    .trim()
    .notEmpty()
    .withMessage('الرجاء ادخال الملاحظات'),
];
