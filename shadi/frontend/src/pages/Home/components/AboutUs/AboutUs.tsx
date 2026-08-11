import personPhoto from "@/assets/images/person11.jpg";
import { alpha, Box, Grid2, Stack, Typography } from "@mui/material";
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

export default AboutUs;
