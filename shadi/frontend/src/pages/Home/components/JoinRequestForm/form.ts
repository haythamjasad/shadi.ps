import * as yup from "yup";
import { ServiceTypeItem } from "./types";

export const validationSchema = yup.object().shape({
  name: yup.string().required("Please enter your name"),
  phone: yup
    .string()
    .matches(
      /^(?:\+|00)[1-9]\d{6,14}$/,
      "Phone number must start with a country code"
    )
    .required("Please enter your phone number"),
  engineeringType: yup
    .array()
    .of(yup.object())
    .min(1, "Select at least one service"),
  graduatedAtObject: yup
    .object()
    .shape({
      label: yup.string(),
      value: yup.number(),
    })
    .required("Please select your year of graduation")
    .nullable(),
  graduatedAt: yup.number().required("Please select a year of graduation"),
  skills: yup
    .string()
    .required("Please enter your skills")
    .min(50, "Skills must be at least 50 characters"),
});

export const initialValues = {
  name: "",
  phone: "",
  engineeringType: [] as ServiceTypeItem[],
  graduatedAt: null as unknown as number,
  graduatedAtObject: null as unknown as { label: string; value: number } | null,
  skills: "",
};
