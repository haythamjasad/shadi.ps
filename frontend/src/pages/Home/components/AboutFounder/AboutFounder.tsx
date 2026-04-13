import personPhoto from "@/assets/images/person3.jpg";
import { alpha, Box, Grid2, Paper, Stack, Typography } from "@mui/material";
import { FC } from "react";
import { brand, logoColor } from "@/style/colors";
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
            <Box sx={{ position: "relative", width: "100%", maxWidth: 620, minHeight: { xs: 320, md: 520 } }}>
              <Paper
                elevation={0}
                sx={{
                  position: "absolute",
                  top: { xs: 14, md: 26 },
                  left: { xs: 0, md: 8 },
                  zIndex: 0,
                  width: { xs: 140, md: 190 },
                  height: { xs: 140, md: 190 },
                  borderRadius: "36px",
                  background: "linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,255,255,0.45))",
                  border: "1px solid rgba(58,55,65,0.08)",
                  backdropFilter: "blur(12px)",
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
                  inset: { xs: "20px 0 auto auto", md: "28px 0 auto auto" },
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
                  right: { xs: 12, md: -10 },
                  bottom: { xs: 16, md: 26 },
                  zIndex: 2,
                  maxWidth: { xs: 230, md: 290 },
                  px: 2.25,
                  py: 1.75,
                  borderRadius: 4,
                  background: "linear-gradient(135deg, rgba(248,160,27,0.92), rgba(237,145,11,0.92))",
                  color: brand[900],
                  boxShadow: "0 22px 48px rgba(248,160,27,0.24)",
                }}
              >
                <Typography sx={{ fontSize: { xs: "8pt", md: "9pt" }, opacity: 0.72, mb: 0.5 }}>
                  المؤسس
                </Typography>
                <Typography sx={{ fontSize: { xs: "10pt", md: "11pt" }, lineHeight: 1.9, fontWeight: 700 }}>
                  خبرة تنفيذية وتعليمية وصناعة محتوى هندسي تربط النظرية بالواقع العملي اليومي.
                </Typography>
              </Paper>
            </Box>
          </Stack>
        </Grid2>
      </Grid2>
    </SectionContainer>
  );
};

export default AboutFounder;
