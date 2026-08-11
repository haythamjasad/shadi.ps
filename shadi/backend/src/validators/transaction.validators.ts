import { body, param } from 'express-validator';
import { Status, Location, ServiceType } from '../entities/Transaction';

const phoneRegex = /^\+?[\d\s\-()]{8,20}$/;
const serviceTypes = Object.values(ServiceType);

const serviceTypeArrayValidator = body('serviceType')
  .customSanitizer((value) => (Array.isArray(value) ? value : [value]))
  .custom((value) => (
    Array.isArray(value)
    && value.length > 0
    && value.every((serviceType) => serviceTypes.includes(serviceType as ServiceType))
  ))
  .withMessage(`يجب أن تكون الخدمات واحدًا أو أكثر من: ${serviceTypes.join(', ')}`);

export const createTransactionValidator = [
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
    .withMessage('يجب أن يكون رقم الهاتف مطابقًا للنمط +xxx xxx xxxx xx'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('بريد إلكتروني غير صالح'),
  serviceTypeArrayValidator,
  body('location')
    .isIn(Object.values(Location))
    .withMessage(`يجب أن يكون الموقع واحدًا من: ${Object.values(Location).join(', ')}`),
  body('notes')
    .trim()
    .notEmpty()
    .withMessage('الرجاء ادخال الملاحظات'),
];

export const updateTransactionValidator = [
  param('id')
    .isNumeric()
    .withMessage('الرقم التسلسلي غير صالح'),
  body('status')
    .optional()
    .isIn(Object.values(Status))
    .withMessage(`يجب أن يكون الحالة واحدًا من: ${Object.values(Status).join(', ')}`),
  body('adminNotes')
    .optional()
    .isString()
    .withMessage('يجب أن تكون ملاحظات المسؤول نصًا'),
  body('adminNotes')
    .custom((value, { req }) => {
      if (req.body?.status && !String(value || '').trim()) {
        throw new Error('يجب إدخال ملاحظة الحالة');
      }
      return true;
    }),
];

export const idParamValidator = [
  param('id')
    .isNumeric()
    .withMessage('الرقم التسلسلي غير صالح'),
];
