import * as yup from "yup";
import { LocationItem, ServiceTypeItem } from "./types";

export const recaptchaEnabled = import.meta.env.PROD && !!import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export const validationSchema = yup.object().shape({
  name: yup.string().required("Please enter your name"),
  email: yup
    .string()
    .email("Please enter a valid email")
    .required("Please enter your email"),
  phone: yup
    .string()
    .matches(
      /^(?:\+|00)[1-9]\d{6,14}$/,
      "Phone number must start with a country code"
    )
    .required("Please enter your phone number"),
  notes: yup.string(),
  selectedServices: yup
    .array()
    .of(yup.object())
    .min(1, "Select at least one service"),
  selectedLocation: yup.object().nullable().required("Location is required"),
  privacyPolicyAgreed: yup
    .boolean()
    .oneOf([true], "You must agree to the privacy policy")
    .required("You must agree to the privacy policy"),
  recaptchaToken: yup.string().when([], {
    is: () => recaptchaEnabled,
    then: (schema) =>
      schema.required("يجب اكمال خيار التحقق."),
    otherwise: (schema) => schema.notRequired(),
  }),
});

export const initialValues = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  selectedServices: [] as ServiceTypeItem[],
  selectedLocation: {} as LocationItem,
  privacyPolicyAgreed: false,
  recaptchaToken: "",
};
