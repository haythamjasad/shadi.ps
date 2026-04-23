import personPhoto from "@/assets/images/person4.jpg";
import ListItem from "@/components/ListItem";
import VerifiedIcon from "@mui/icons-material/Verified";
import { alpha, Box, Grid2, List, Stack } from "@mui/material";
import { Lightbulb, ScanLine, Target, Timer, TrendingUp } from "lucide-react";
import { FC } from "react";
import SectionContainer from "../UI/SectionContainer";
import SectionTitle from "../UI/SectionsTitle";

const CoreValues: FC = () => {
  return (
    <SectionContainer id="core_values">
      <SectionTitle logo={<VerifiedIcon sx={{fontSize: { xs: "40px", md: "50px" }}} />}>
        قِيَمُنا
      </SectionTitle>
      <Grid2 container spacing={6} justifyContent="center" alignItems="center">
        <Grid2 size={{ xs: 12, sm: 12, md: 6 }}>
          <Stack
            spacing={2}
            justifyContent="center"
            height="100%"
            alignItems="center"
          >
            <List sx={{ 
              width: "100%", 
              maxWidth: { xs: "100%", md: "600px" }              
            }}>
              <ListItem
                icon={<Target />}
                primary="الدقة المهنية"
                secondary="التفاصيل الصغيرة تصنع فرقاً كبيراً في جودة المشروع."
              />
              <ListItem
                icon={<ScanLine />}
                primary="الشفافية"
                secondary=" تقارير واضحة لا تحتمل التأويل، وقرارات مبنية على معطيات واقعية."
              />
              <ListItem
                icon={<Timer />}
                primary="الالتزام"
                secondary="حضور ميداني، متابعة مستمرة، وتسليم في المواعيد."
              />
              <ListItem
                icon={<Lightbulb />}
                primary="الحلول العملية"
                secondary="تقديم خيارات واقعية قابلة للتنفيذ وليست مجرد توصيات على الورق."
              />
              <ListItem
                icon={<TrendingUp />}
                primary="التطوير المستمر"
                secondary="مواكبة أحدث المعايير والأنظمة الهندسية عالمياً."
              />
            </List>
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

export default CoreValues;
