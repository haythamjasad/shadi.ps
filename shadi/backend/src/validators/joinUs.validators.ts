import { body, param } from 'express-validator';
import { ServiceType } from '../entities/Transaction';

const phoneRegex = /^\+?[\d\s\-()]{8,20}$/;

export const createJoinUsValidator = [
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
  body('engineeringType')
    .isIn(Object.values(ServiceType))
    .withMessage(`يجب أن تكون الخدمات واحدًا من: ${Object.values(ServiceType).join(', ')}`),
  body('skills')
    .trim()
    .notEmpty()
    .withMessage('الرجاء ادخال المهارات'),
  body('graduatedAt')
    .trim()
    .notEmpty()
    .withMessage('الرجاء ادخال سنة التخرج'),
];

export const updateJoinUsValidator = [
  param('id')
    .isNumeric()
    .withMessage('الرقم التسلسلي غير صالح'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('الرجاء ادخال الاسم')
    .isLength({ max: 100 })
    .withMessage('يجب أن يكون الاسم أقل من 100 حرف'),
  body('phone')
    .optional()
    .trim()
    .matches(phoneRegex)
    .withMessage('يجب أن يكون رقم الهاتف مطابقًا للنمط +xxx xxx xxxx xx'),
  body('engineeringType')
    .optional()
    .isIn(Object.values(ServiceType))
    .withMessage(`يجب أن تكون الخدمات واحدًا من: ${Object.values(ServiceType).join(', ')}`),
  body('skills')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('الرجاء ادخال المهارات'),
  body('graduatedAt')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('الرجاء ادخال سنة التخرج'),
];

export const idParamValidator = [
  param('id')
    .isNumeric()
    .withMessage('الرقم التسلسلي غير صالح'),
];
