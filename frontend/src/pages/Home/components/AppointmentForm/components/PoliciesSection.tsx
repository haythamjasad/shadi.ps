import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Stack,
  Typography,
} from "@mui/material";
import { ChevronDown } from "lucide-react";
import { FC } from "react";
import { PoliciesSectionProps } from "../types";

const PoliciesSection: FC<PoliciesSectionProps> = ({
  agreed,
  onChange,
  error,
  touched,
  transparency,
}) => {
  return (
    <>
      <Accordion
        sx={(theme) => ({
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          p: 0,
          "&:before": { display: "none" },
          boxShadow: theme.shadows[1],
          backgroundColor: theme.palette.background.paper,
        })}
      >
        <AccordionSummary
          expandIcon={<ChevronDown />}
          sx={(theme) => ({
            backgroundColor: alpha(
              theme.palette.primary.main,
              typeof transparency === "number" ? transparency : 0.08
            ),
            borderRadius: "4px 4px 0 0",
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.12),
            },
            "& .MuiAccordionSummary-content": {
              margin: "12px 0",
            },
          })}
        >
          <Typography
            fontWeight="bold"
            color="primary"
            fontSize="clamp(9pt, 1vw, 12pt)"
          >
            اقرأ الشروط والسياسات
          </Typography>
        </AccordionSummary>
        <AccordionDetails
          sx={(theme) => ({
            maxHeight: 300,
            overflow: "auto",
            backgroundColor: theme.palette.background.paper,
            borderTop: `1px solid ${theme.palette.divider}`,
          })}
        >
          <Stack spacing={2}>
            <Typography
              fontWeight="bold"
              fontSize="clamp(8pt, 1vw, 10pt)"
              textAlign="center"
            >
              الشروط والسياسات
            </Typography>

            {/* أولاً: نطاق الخدمة وطبيعتها */}
            <Box>
              <Typography
                fontWeight="bold"
                fontSize="clamp(8pt, 1vw, 10pt)"
                sx={{ mb: 0.5 }}
              >
                أولاً: نطاق الخدمة وطبيعتها
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  الاستشارات المقدمة هي استشارات هندسية تقييمية وتوضيحية تعتمد
                  على المشاهدات العينية الظاهرة، ولا تشمل بأي حال من الأحوال
                  أعمال التكسير أو أعمال الفحص المتخصصة التي تعتمد على أجهزة فحص
                  وقياس خاصة أو فحوصات مخبرية أو اختبارات مواد وكذلك لا تشمل
                  إعداد مخططات تنفيذية أو حسابات هندسية تفصيلية.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  قد تُظهر الاستشارة وجود أخطاء تنفيذية، أو تؤكد سلامة الأعمال
                  الظاهرة، ولا تضمن الكشف عن جميع العيوب أو الأخطاء الخفية أو
                  المستقبلية.
                </Typography>
              </Box>
            </Box>

            {/* ثانياً: التخصص، المعاينة، وحدود المسؤولية */}
            <Box>
              <Typography
                fontWeight="bold"
                fontSize="clamp(8pt, 1vw, 10pt)"
                sx={{ mb: 0.5 }}
              >
                ثانياً: التخصص، المعاينة، وحدود المسؤولية
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  يلتزم العميل باختيار نوع الاستشارة المناسب (ميكانيك / معماري /
                  مدني / كهرباء)، وتقع مسؤولية هذا الاختيار على العميل بالكامل.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  في حال تبيّن أثناء الاستشارة أن المشكلة القائمة تتطلب تخصصاً
                  مختلفاً عن التخصص الذي اختاره العميل، لا يتحمل مقدم الخدمة أي
                  مسؤولية عن عدم تشخيص المشكلة أو عدم تناولها ضمن الاستشارة.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  تعتمد نتائج الاستشارة على الحالة الظاهرة وقت المعاينة فقط
                  (سواء كانت ميدانية أو أونلاين)، ولا تمتد لأي تغييرات لاحقة أو
                  أعمال تُنفذ بعد الاستشارة.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  عدم تسجيل ملاحظات أو أخطاء لا يُعد تقصيراً أو إهمالاً، وتُعتبر
                  الخدمة منفذة بالكامل ضمن نطاقها المتفق عليه.
                </Typography>
              </Box>
            </Box>

            {/* ثالثاً: المواعيد وتنظيمها */}
            <Box>
              <Typography
                fontWeight="bold"
                fontSize="clamp(8pt, 1vw, 10pt)"
                sx={{ mb: 0.5 }}
              >
                ثالثاً: المواعيد وتنظيمها
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  بعد إتمام الدفع الإلكتروني، يتم التشاور والاتفاق بين مقدم
                  الخدمة والعميل على تحديد موعد الاستشارة، سواء كانت أونلاين أو
                  ميدانية، على أن تكون مدة الاستشارة الأونلاين من ثلاثين إلى
                  أربعين دقيقة، بينما تخضع الاستشارة الميدانية لطبيعة الموقع
                  والحالة محل المعاينة دون تحديد مدة زمنية ثابتة.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  يتم تحديد موعد الاستشارة خلال مدة أقصاها اثنتان وسبعون ساعة من
                  تاريخ الدفع، غير شاملة العطل الرسمية والأعياد.
                </Typography>
              </Box>
            </Box>

            {/* رابعاً: الإلغاء والاسترجاع */}
            <Box>
              <Typography
                fontWeight="bold"
                fontSize="clamp(8pt, 1vw, 10pt)"
                sx={{ mb: 0.5 }}
              >
                رابعاً: الإلغاء والاسترجاع
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  يحق للعميل إلغاء الموعد قبل 24 ساعة على الأقل من الموعد المتفق
                  عليه.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  في حال الإلغاء ضمن المدة المسموحة، يتم استرجاع المبلغ بعد خصم
                  10% أتعاب إدارية.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  في حال عدم تواجد العميل أو من ينوب عنه في الموعد المحدد،
                  يُعتبر الموعد ملغياً حكماً ولا يحق له المطالبة بأي استرجاع
                  مالي.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  بعد تنفيذ الاستشارة، سواء كانت أونلاين أو ميدانية، لا يحق
                  للعميل المطالبة بأي استرجاع تحت أي ظرف.
                </Typography>
              </Box>
            </Box>

            {/* خامساً: الاستشارة الميدانية */}
            <Box>
              <Typography
                fontWeight="bold"
                fontSize="clamp(8pt, 1vw, 10pt)"
                sx={{ mb: 0.5 }}
              >
                خامساً: الاستشارة الميدانية
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  تشمل الاستشارة الميدانية الوقت، والتنقل، والمعاينة، والفحص
                  الظاهري القائم على الخبرة الهندسية.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  لا تشمل الاستشارة الميدانية الإشراف المستمر أو متابعة التنفيذ.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  لا يتحمل مقدم الخدمة أي مسؤولية قانونية أو فنية عن الأعمال
                  المنفذة من قبل الغير.
                </Typography>
              </Box>
            </Box>

            {/* سادساً: البيانات والخصوصية */}
            <Box>
              <Typography
                fontWeight="bold"
                fontSize="clamp(8pt, 1vw, 10pt)"
                sx={{ mb: 0.5 }}
              >
                سادساً: البيانات والخصوصية
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  يلتزم مقدم الخدمة بحماية بيانات العميل وخصوصيته.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  يتم استخدام البيانات فقط لأغراض تنظيم المواعيد وتقديم الخدمة
                  الاستشارية.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  لا يتم مشاركة بيانات العميل مع أي طرف ثالث.
                </Typography>
              </Box>
            </Box>

            {/* سابعاً: الإقرار والموافقة */}
            <Box>
              <Typography
                fontWeight="bold"
                fontSize="clamp(8pt, 1vw, 10pt)"
                sx={{ mb: 0.5 }}
              >
                سابعاً: الإقرار والموافقة
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  إتمام عملية الدفع يُعد إقراراً صريحاً من العميل بالاطلاع على
                  جميع الشروط والسياسات أعلاه.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  يقرّ العميل بفهمه الكامل لطبيعة وحدود الخدمة الاستشارية.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 0.5 }}
                >
                  يوافق العميل على جميع ما ورد دون أي تحفظ أو ادعاء لاحق.
                </Typography>
              </Box>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Privacy Policy Agreement Checkbox */}
      <Box sx={{ mt: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={agreed}
              onChange={(e) => onChange(e.target.checked)}
              name="privacyPolicyAgreed"
              color="primary"
              sx={{ transform: "scaleX(-1)", padding: 0.5 }}
            />
          }
          label={
            <Typography sx={{ fontSize: "clamp(8pt, 1vw, 10pt)" }}>
              أوافق على سياسة الخصوصية والاسترجاع والاستبدال{" "}
            </Typography>
          }
        />
        {touched && error && <FormHelperText error>{error}</FormHelperText>}
      </Box>
    </>
  );
};

export default PoliciesSection;
