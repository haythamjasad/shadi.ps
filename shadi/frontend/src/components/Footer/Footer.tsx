import mastercardIcon from "@/assets/images/mastercard.png";
import visaIcon from "@/assets/images/visa.png";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { FC, useState } from "react";
import {
  FaEnvelope,
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaWhatsapp,
} from "react-icons/fa";
import styles from "./styles.module.css";

const Footer: FC = () => {
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  const handleOpenPolicies = () => setPoliciesOpen(true);
  const handleClosePolicies = () => setPoliciesOpen(false);

  return (
    <Box className={styles.footerShell}>
      <footer className={styles.outerFooter}>
        <div className={styles.footerInner}>
          <div className={styles.mobileAccentOrange} />
          <div className={styles.mobileAccentDark} />
          <div className={styles.mobileCorner} />
          <div className={styles.desktopAccentOrange} />
          <div className={styles.desktopAccentDark} />
          <div className={styles.desktopCorner} />

          <div className={styles.desktopLogoBadge}>
            <img src="/circle_logo_footer.png" className={styles.brandLogo} alt="شعار شادي شرّي" />
          </div>

          <div className={styles.footerSpacer}>
            <div className={styles.mobileTopRow} dir="ltr">
              <div className={styles.mobileContent}>
                <div className={styles.mobileSocialRow}>
                  <a href="https://www.facebook.com/share/1Fgc18pkRL/" target="_blank" rel="noreferrer" className={`${styles.socialLink} ${styles.facebook}`} aria-label="Facebook"><FaFacebookF /></a>
                  <a href="https://www.instagram.com/shadi_shirri/" target="_blank" rel="noreferrer" className={`${styles.socialLink} ${styles.instagram}`} aria-label="Instagram"><FaInstagram /></a>
                  <a href="https://www.tiktok.com/@shadishirri?_r=1&_t=ZS-91y8i3OcOJh" target="_blank" rel="noreferrer" className={`${styles.socialLink} ${styles.tiktok}`} aria-label="TikTok"><FaTiktok /></a>
                  <a href="https://wa.me/+972568114114" target="_blank" rel="noreferrer" className={`${styles.socialLink} ${styles.whatsapp}`} aria-label="WhatsApp"><FaWhatsapp /></a>
                  <a href="mailto:info@shadi.ps" className={`${styles.socialLink} ${styles.email}`} aria-label="Email"><FaEnvelope /></a>
                  <img src={visaIcon} alt="Visa" className={styles.mobileCardIcon} loading="lazy" />
                  <img src={mastercardIcon} alt="MasterCard" className={styles.mobileCardIcon} loading="lazy" />
                </div>
                <div className={styles.mobileRightsText} dir="rtl">
                  جميع الحقوق محفوظة © شركة شادي شري للهندسة والاستشارات {currentYear} |
                  <button type="button" className={styles.policyLink} onClick={handleOpenPolicies}>اقرأ الشروط والسياسات</button>
                </div>
              </div>
              <div className={styles.mobileLogoBadge}>
                <img src="/circle_logo_footer.png" className={styles.brandLogo} alt="شعار شادي شرّي" />
              </div>
            </div>
          </div>

          <div className={styles.footerContent}>
            <div className={styles.desktopContent} dir="rtl">
              <div className={styles.companyName}>شركة شادي شري للهندسة والاستشارات</div>

              <div className={styles.desktopMetaRow} dir="ltr">
                <div className={styles.desktopSocialRow}>
                  <a href="https://www.facebook.com/share/1Fgc18pkRL/" target="_blank" rel="noreferrer" className={`${styles.socialLink} ${styles.facebook}`} aria-label="Facebook"><FaFacebookF /></a>
                  <a href="https://www.instagram.com/shadi_shirri/" target="_blank" rel="noreferrer" className={`${styles.socialLink} ${styles.instagram}`} aria-label="Instagram"><FaInstagram /></a>
                  <a href="https://www.tiktok.com/@shadishirri?_r=1&_t=ZS-91y8i3OcOJh" target="_blank" rel="noreferrer" className={`${styles.socialLink} ${styles.tiktok}`} aria-label="TikTok"><FaTiktok /></a>
                  <a href="https://wa.me/+972568114114" target="_blank" rel="noreferrer" className={`${styles.socialLink} ${styles.whatsapp}`} aria-label="WhatsApp"><FaWhatsapp /></a>
                  <a href="mailto:info@shadi.ps" className={`${styles.socialLink} ${styles.email}`} aria-label="Email"><FaEnvelope /></a>
                </div>
                <div className={styles.desktopPaymentRow}>
                  <img src={visaIcon} alt="Visa" className={styles.desktopCardIcon} loading="lazy" />
                  <img src={mastercardIcon} alt="MasterCard" className={styles.desktopCardIcon} loading="lazy" />
                </div>
              </div>

              <div className={styles.desktopRightsText}>
                جميع الحقوق محفوظة © شركة شادي شري للهندسة والاستشارات {currentYear} |
                <button type="button" className={styles.policyLinkDesktop} onClick={handleOpenPolicies}>اقرأ الشروط والسياسات</button>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <Dialog
        open={policiesOpen}
        onClose={handleClosePolicies}
        fullWidth
        maxWidth="md"
        aria-labelledby="policies-dialog-title"
      >
        <DialogTitle id="policies-dialog-title" sx={{ fontWeight: "bold" }}>
          سياسة الخصوصية والاسترجاع والاستبدال
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography
              fontWeight="bold"
              fontSize="clamp(9pt, 1vw, 11pt)"
              textAlign="center"
            >
              الشروط والسياسات
            </Typography>

            {/* أولاً: نطاق الخدمة وطبيعتها */}
            <Box>
              <Typography
                fontWeight="bold"
                fontSize="clamp(8pt, 1vw, 10pt)"
                sx={{ mb: 1 }}
              >
                أولاً: نطاق الخدمة وطبيعتها
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
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
                  sx={{ mb: 1 }}
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
                sx={{ mb: 1 }}
              >
                ثانياً: التخصص، المعاينة، وحدود المسؤولية
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  يلتزم العميل باختيار نوع الاستشارة المناسب (ميكانيك / معماري /
                  مدني / كهرباء)، وتقع مسؤولية هذا الاختيار على العميل بالكامل.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  في حال تبيّن أثناء الاستشارة أن المشكلة القائمة تتطلب تخصصاً
                  مختلفاً عن التخصص الذي اختاره العميل، لا يتحمل مقدم الخدمة أي
                  مسؤولية عن عدم تشخيص المشكلة أو عدم تناولها ضمن الاستشارة.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  تعتمد نتائج الاستشارة على الحالة الظاهرة وقت المعاينة فقط
                  (سواء كانت ميدانية أو أونلاين)، ولا تمتد لأي تغييرات لاحقة أو
                  أعمال تُنفذ بعد الاستشارة.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
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
                sx={{ mb: 1 }}
              >
                ثالثاً: المواعيد وتنظيمها
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
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
                  sx={{ mb: 1 }}
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
                sx={{ mb: 1 }}
              >
                رابعاً: الإلغاء والاسترجاع
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  يحق للعميل إلغاء الموعد قبل 24 ساعة على الأقل من الموعد المتفق
                  عليه.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  في حال الإلغاء ضمن المدة المسموحة، يتم استرجاع المبلغ بعد خصم
                  10% أتعاب إدارية.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  في حال عدم تواجد العميل أو من ينوب عنه في الموعد المحدد،
                  يُعتبر الموعد ملغياً حكماً ولا يحق له المطالبة بأي استرجاع
                  مالي.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
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
                sx={{ mb: 1 }}
              >
                خامساً: الاستشارة الميدانية
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  تشمل الاستشارة الميدانية الوقت، والتنقل، والمعاينة، والفحص
                  الظاهري القائم على الخبرة الهندسية.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  لا تشمل الاستشارة الميدانية الإشراف المستمر أو متابعة التنفيذ.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
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
                sx={{ mb: 1 }}
              >
                سادساً: البيانات والخصوصية
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  يلتزم مقدم الخدمة بحماية بيانات العميل وخصوصيته.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  يتم استخدام البيانات فقط لأغراض تنظيم المواعيد وتقديم الخدمة
                  الاستشارية.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
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
                sx={{ mb: 1 }}
              >
                سابعاً: الإقرار والموافقة
              </Typography>
              <Box component="ol" sx={{ pl: 4, m: 0 }}>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  إتمام عملية الدفع يُعد إقراراً صريحاً من العميل بالاطلاع على
                  جميع الشروط والسياسات أعلاه.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  يقرّ العميل بفهمه الكامل لطبيعة وحدود الخدمة الاستشارية.
                </Typography>
                <Typography
                  component="li"
                  fontSize="clamp(8pt, 1vw, 10pt)"
                  sx={{ mb: 1 }}
                >
                  يوافق العميل على جميع ما ورد دون أي تحفظ أو ادعاء لاحق.
                </Typography>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePolicies} color="primary">
            إغلاق
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Footer;
