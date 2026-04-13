import personPhoto from "@/assets/images/person11.jpg";
import { alpha, Box, Grid2, Paper, Stack, Typography } from "@mui/material";
import { FC } from "react";
import { logoColor } from "@/style/colors";
import SectionContainer from "../UI/SectionContainer";
import TextSlicer from "../UI/TextSlicer";
const AboutUs: FC = () => {
  return (
    <SectionContainer id="about_us">
      <Grid2 container spacing={2} justifyContent="center" alignItems="flex-start">
        <Grid2 size={{ xs: 12, sm: 12, md: 6 }}>
          <Stack
            spacing={1}
            justifyContent="flex-start"
            height="100%"
            alignItems="center"
            pt={{ xs: 1, md: 2 }}
          >
            {/* <SectionTitle logo={<GroupsIcon sx={{color: logoColor, fontSize: { xs: "40px", md: "50px" }}}/>}>
              من نحن
            </SectionTitle> */}

            <Typography
              sx={{
                color: logoColor,
                width: "100%",
                fontSize: { xs: "16pt", md: "34pt" },
                fontWeight: "bold",
                textAlign: { xs: "left", md: "center" },
                position: "relative",
                display: "inline-flex",
                justifyContent: { xs: "flex-start", md: "center" },
                pb: 1.5,
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: 0,
                  width: { xs: 90, md: 120 },
                  height: 4,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, rgba(248,160,27,0.2), rgba(248,160,27,0.9), rgba(248,160,27,0.2))",
                },
              }}
            >
              الشركة
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                alignSelf: "center",
                width: "100%",
                maxWidth: "600px",
                fontSize: { xs: "10pt", md: "14pt" },
                textAlign: "justify",
                p: { xs: 2, md: 3 },
                borderRadius: 4,
                background: "linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.44))",
                border: "1px solid rgba(58,55,65,0.08)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 18px 40px rgba(58,55,65,0.06)",
                lineHeight: { xs: 2, md: 2.15 },
              }}
            >
              <TextSlicer>
                تأسست شركة شادي شري للهندسة والاستشارات لتكون مرجعاً هندسياً
                موثوقاً يقدم خدمات هندسية فريدة تجمع بين المعايير الهندسية
                والخبرة الميدانية. جاءت الشركة استجابة لحاجة قطاع البناء إلى جهة
                قادرة على الجمع بين التحليل الهندسي العميق، وإدارة المشاريع
                الحديثة، والتطبيق العملي في مواقع العمل، بما يضمن تنفيذ المشاريع
                وفق أعلى معايير الجودة والسلامة. نعمل على تقديم خدمات الإشراف
                الهندسي، والمعاينات الميدانية، وإصدار التقارير الفنية، ومعالجة
                المشكلات التي تظهر أثناء التنفيذ او بعده ، مستندين إلى منهجية
                تقوم على قراءة التفاصيل، وتحليل المعطيات، واتخاذ القرارات
                المبنية على بيانات دقيقة بعيداً عن الاجتهادات غير الموثوقة.
                تعتمد الشركة منهجاً يدمج بين التفكير الهندسي والابتكار التقني
                لتقديم حلولا اكثر تطورا وكفاءة من خلال فريق هندسي متكامل يضم
                مجموعة من المهندسين المتخصصين في مجالات الهندسة الميكانيكية
                والكهربائية ، والهندسة المعمارية والانشائية والتصميم الداخلي حيث
                يعمل هذا الفريق بتناغم مهني تحت إدارة مباشرة من المهندس شادي
                شري، لضمان تنسيق القرارات الفنية، وتحقيق تكامل الأنظمة داخل
                المشروع، وتقديم حلول واقعية قابلة للتطبيق. إن حضورنا الميداني
                المستمر، وتقديمنا للحلول العملية، ورصدنا للأخطاء قبل ظهورها،
                واكتشافنا للمخاطر قبل حدوثها، كلها عناصر تجعل من خدماتنا قيمة
                مضافة لكل صاحب مشروع يسعى إلى تنفيذٍ هندسي سليم، وإدارة فنية
                موثوقة، ونتائج تُبنى على أسس علمية واضحة.
              </TextSlicer>
            </Typography>
          </Stack>
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 12, md: 6 }}>
          <Stack justifyContent="center" alignItems="center" height="100%">
            <Box sx={{ position: "relative", width: "100%", maxWidth: 620, minHeight: { xs: 320, md: 520 } }}>
              <Box
                sx={{
                  position: "absolute",
                  top: { xs: 10, md: 12 },
                  right: { xs: 10, md: 18 },
                  width: { xs: 160, md: 210 },
                  height: { xs: 160, md: 210 },
                  borderRadius: "32px",
                  background: "linear-gradient(135deg, rgba(248,160,27,0.36), rgba(248,160,27,0.05))",
                  border: "1px solid rgba(248,160,27,0.18)",
                }}
              />
              <Box
                component="img"
                src={personPhoto}
                width="100%"
                maxWidth="580px"
                alt="person photo"
                sx={(theme) => ({
                  position: "absolute",
                  inset: { xs: "28px auto auto 0", md: "34px auto auto 0" },
                  borderRadius: "42px",
                  objectFit: "cover",
                  border: "1px solid rgba(255,255,255,0.7)",
                  boxShadow: `0 28px 65px ${alpha(theme.palette.primary.main, 0.16)}, 0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
                })}
              />
              <Paper
                elevation={0}
                sx={{
                  position: "absolute",
                  left: { xs: 14, md: -8 },
                  bottom: { xs: 18, md: 28 },
                  zIndex: 2,
                  maxWidth: { xs: 230, md: 280 },
                  px: 2.25,
                  py: 1.75,
                  borderRadius: 4,
                  background: "linear-gradient(135deg, rgba(58,55,65,0.92), rgba(34,32,40,0.92))",
                  color: "#fff",
                  boxShadow: "0 22px 48px rgba(23,21,28,0.24)",
                }}
              >
                <Typography sx={{ fontSize: { xs: "8pt", md: "9pt" }, opacity: 0.72, mb: 0.5 }}>
                  هوية الشركة
                </Typography>
                <Typography sx={{ fontSize: { xs: "10pt", md: "11pt" }, lineHeight: 1.9 }}>
                  شركة تجمع بين القراءة الهندسية الدقيقة والخبرة الميدانية والتنفيذ العملي في الموقع.
                </Typography>
              </Paper>
            </Box>
          </Stack>
        </Grid2>
      </Grid2>
    </SectionContainer>
  );
};

export default AboutUs;
