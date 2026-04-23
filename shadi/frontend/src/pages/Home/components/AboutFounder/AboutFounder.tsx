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
                تخرج شادي شري في الهندسة الميكانيكية من جامعة النجاح الوطنية عام
                2009، ثم واصل مساره الأكاديمي بالحصول على درجة الماجستير في
                إدارة الأعمال من جامعة بيرزيت عام 2022، وهو اليوم يتابع دراساته
                العليا في برنامج الدكتوراه في الإدارة الاستراتيجية في جامعة
                إشبيلية في إسبانيا، في إطار يعكس التزامه بالتطوير المهني المستمر
                وبناء معرفة متكاملة تربط الهندسة بالإدارة. بدأ شري مسيرته
                المهنية عام 2009 في تصميم الأنظمة الميكانيكية وإدارة تنفيذها
                والإشراف عليها ، وقد تولّى خلال مسيرته تنفيذ وإدارة العديد من
                المشاريع الهندسية الحساسة والكبيرة في فلسطين، اضافة الى حضوره
                المؤثر في قطاع التدريب الهندسي في فلسطين والوطن العربي ، حيث
                يقدّم دورات متقدمة في التصميم الهندسي وأنظمة ميكانيكا المباني
                لمئات المهندسين والطلبة، وقد درّب في نقابة المهندسين وعدد من
                الجامعات الفلسطينية والعديد من المراكز المهنية المتخصصة. إلى
                جانب ذلك، يشغل عضويات فعّالة في هيئات ومجالس قطاعية وهندسية، فهو
                عضوا في لجنة فرع رام الله التابعة لاتحاد المقاولين الفلسطينيين
                منذ عام 2017، وعضوا في لجنة توصيف الأنابيب البلاستيكية وتوابعها
                في وزارة المواصفات والمقاييس الفلسطينية منذ عام 2023، بالإضافة
                إلى مشاركته في عدد من اللجان والجمعيات الهندسية التي تسهم في
                تطوير المعايير والممارسات المهنية داخل القطاع. إلى جانب عمله
                الهندسي، يُعد شادي أحد أبرز صُنّاع المحتوى الهندسي في الوطن
                العربي، إذ يتابعه مئات الآلاف على منصّات التواصل الاجتماعي، حيث
                يقدّم محتوى علمياً مبسطاً يربط بين الهندسة والواقع العملي ويركز
                على الأخطاء الشائعة في البناء وأفضل الممارسات المهنية.
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
