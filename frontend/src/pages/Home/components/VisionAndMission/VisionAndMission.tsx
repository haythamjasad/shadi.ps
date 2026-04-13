import personPhoto from "@/assets/images/person3.jpg";
import { alpha, Box, Grid2, Stack, Typography } from "@mui/material";
import { Eye } from "lucide-react";
import { FC } from "react";
import SectionContainer from "../UI/SectionContainer";
import SectionTitle from "../UI/SectionsTitle";
import TextSlicer from "../UI/TextSlicer";

const VisionAndMission: FC = () => {
  return (
    <SectionContainer id="mission_vision">
      <Grid2 container spacing={6} justifyContent="center" alignItems="center">
        <Grid2 size={{ xs: 12, sm: 12, md: 6 }}>
          <Stack
            spacing={2}
            justifyContent="center"
            height="100%"
            alignItems="center"
          >
            <SectionTitle
              logo={
                <Box
                  sx={{ fontSize: { xs: "38px", md: "48px" }, display: "flex" }}
                >
                  <Eye size="1em" strokeWidth={1.5} />
                </Box>
              }
            >
              رؤيتنا ورسالتنا
            </SectionTitle>
            <Typography
              color="text.secondary"
              sx={{
                alignSelf: "center",
                width: "100%",
                maxWidth: "600px",
                fontSize: { xs: "8pt", md: "14pt" },
                textAlign: "justify",
              }}
            >
              <TextSlicer>
                أن نكون المرجع الهندسي الأكثر وثوقية في فلسطين والمنطقة ،
                والقادر على تقديم استشارات دقيقة وحلول مبتكرة تُسهم في رفع جودة
                التنفيذ وتحسين كفاءة مشاريع البناء بمختلف أنواعها. و تقديم خدمات
                هندسية مبنية على الدقة، والتحليل الفني، والمعايير العلمية، مع
                متابعة ميدانية حقيقية تضمن تنفيذ الأعمال كما يجب أن تكون، وبما
                يحقق قيمة مضافة للعميل ويرفع وثوقية قطاع البناء.
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
                      2px 3px 6px -1px ${alpha(
                        theme.palette.primary.main,
                        0.35
                      )},
                      8px 8px 20px -3px ${alpha(
                        theme.palette.primary.main,
                        0.35
                      )}
                    `,
              })}
            />
          </Stack>
        </Grid2>
      </Grid2>
    </SectionContainer>
  );
};

export default VisionAndMission;
