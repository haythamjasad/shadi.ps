import personPhoto from "@/assets/images/person3.jpg";
import { alpha, Box, Grid2, Stack, Typography } from "@mui/material";
import { FC } from "react";
import { logoColor } from "@/style/colors";
import SectionContainer from "../UI/SectionContainer";
import TextSlicer from "../UI/TextSlicer";

const AboutFounder: FC = () => {
  return (
    <SectionContainer id="founder_profile">
      <Grid2 container spacing={2} justifyContent="center" alignItems="flex-start">
        <Grid2 size={{ xs: 12, sm: 12, md: 6 }}>
          <Stack
            spacing={1}
            justifyContent="flex-start"
            height="100%"
            alignItems="center"
            pt={{ xs: 1, md: 2 }}
          >
            {/* <SectionTitle
              logo={<EngineeringIcon style={{ fontSize: "50px" }} />}
            >
              نبذة عن المؤسس
            </SectionTitle> */}

            <Typography
              sx={() => ({
                color: logoColor,
                width: "100%",
                fontSize: { xs: "16pt", md: "34pt" },
                fontWeight: "bold",
                textAlign: { xs: "left", md: "center" },
              })}
            >
              المؤسس
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                alignSelf: "center",
                width: "100%",
                maxWidth: "600px",
                fontSize: { xs: "10pt", md: "14pt" },
                textAlign: "justify",
              }}
            >
              <TextSlicer>
                تخرّج المهندس شادي شري في تخصص الهندسة الميكانيكية من جامعة
                النجاح الوطنية عام 2009، ثم واصل مسيرته الأكاديمية بحصوله على
                درجة الماجستير في إدارة الأعمال من جامعة بيرزيت عام 2022، ويواصل
                حالياً دراساته العليا في برنامج الدكتوراه في الإدارة الاستراتيجية
                في جامعة إشبيلية في إسبانيا، في مسار يعكس التزامه بالتطوير
                المهني المستمر وبناء معرفة متكاملة تربط بين الهندسة والإدارة.

                بدأ شادي شري مسيرته المهنية عام 2009 في تصميم الأنظمة الهندسية
                وإدارة تنفيذها والإشراف عليها، حيث تولّى تنفيذ وإدارة العديد من
                المشاريع الهندسية الكبرى والحساسة في فلسطين، مع خبرة عملية متقدمة
                في ربط الحلول الهندسية بالتطبيق الميداني وفق أفضل الممارسات
                المهنية.

                طوّر المهندس شادي شري “معيار اليد الواحدة”، كمنهج عملي لضبط جودة
                المنتجات المستخدمة في مشاريع البناء ، حيث يقوم هذا المعيار على
                استبعاد أي منتج تتعدد مصادر توريده، واعتماد فقط المنتجات التي
                تمتلك مصدراً واحداً واضحاً وقابلاً للتتبع والتحقق من سلاسل
                إمداده وتوريده ، بما يحدّ من التلاعب، ويعزز موثوقية المواد، ويعيد
                تعريف المنافسة لتكون بين منتجات مختلفة ذات مصادر معلومة، وليس بين
                نسخ متعددة من نفس المنتج بعضها معروف المصدر والاخر مجهول المصدر.

                كما يتمتع شادي شري بحضور مؤثر في قطاع التدريب الهندسي في فلسطين
                والوطن العربي، حيث يقدّم دورات متقدمة في التصميم الهندسي وأنظمة
                ميكانيكا المباني لمئات المهندسين والطلبة، وقد درّب في نقابة
                المهندسين وعدد من الجامعات الفلسطينية، إضافة إلى العديد من المراكز
                المهنية المتخصصة.

                ويشغل عضويات فاعلة في عدد من الهيئات والمجالس القطاعية، فهو عضو
                في لجنة فرع رام الله التابعة لاتحاد المقاولين الفلسطينيين منذ عام
                2017، وعضو في لجنة توصيف الأنابيب البلاستيكية وتوابعها في وزارة
                المواصفات والمقاييس الفلسطينية منذ عام 2023، إلى جانب مشاركته في
                لجان وجمعيات هندسية تسهم في تطوير المعايير والممارسات المهنية.

                إلى جانب عمله الهندسي، يُعد شادي شري من أبرز صنّاع المحتوى
                الهندسي في الوطن العربي، حيث يتابعه مئات الآلاف على منصّات
                التواصل الاجتماعي، ويقدّم محتوى علمياً مبسطاً يربط بين الهندسة
                والتطبيق الواقعي، مع تركيز خاص على الأخطاء الشائعة في قطاع البناء
                وأفضل الممارسات المهنية.
              </TextSlicer>
            </Typography>
          </Stack>
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 12, md: 6 }}>
          <Stack justifyContent="center" alignItems="center" height="100%">
            <Box
              component="img"
              src={personPhoto}
              width="100%"
              maxWidth="600px"
              alt="person photo"
              sx={(theme) => ({
                marginBlock: "auto",
                borderRadius: "10%",
                objectFit: "cover",
                boxShadow: `
              0 0 4px ${alpha(theme.palette.primary.main, 0.25)},
              2px 3px 6px -1px ${alpha(theme.palette.primary.main, 0.35)},
              8px 8px 20px -3px ${alpha(theme.palette.primary.main, 0.35)}
            `,
              })}
            />
          </Stack>
        </Grid2>
      </Grid2>
    </SectionContainer>
  );
};

export default AboutFounder;
