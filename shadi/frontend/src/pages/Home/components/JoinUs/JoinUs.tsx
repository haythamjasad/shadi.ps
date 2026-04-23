import { alpha, Stack, Typography } from "@mui/material";
import { FC } from "react";
import SectionContainer from "../UI/SectionContainer";
import JoinRequestForm from "../JoinRequestForm";
import TextSlicer from "../UI/TextSlicer";
import { logoBGColor, logoColor } from "@/style/colors";
const JoinUs: FC = () => {
  return (
    <SectionContainer id="join_our_family">
      {/* <SectionTitle logo={<Diversity3Icon sx={{fontSize: { xs: "40px", md: "50px" }}} />}>
      </SectionTitle> */}
      <Typography
        sx={() => ({
          color: logoColor,
          width: "100%",
          fontSize: { xs: "16pt", md: "34pt" },
          fontWeight: "bold",
          textShadow: `0 3px 5px ${alpha(logoBGColor, 0.6)}`,
          textAlign: { xs: "left", md: "center" },
        })}
      >
        انضم إلى عائلتنا
      </Typography>
      <Stack
        spacing={2}
        justifyContent="center"
        height="100%"
        alignItems="center"
        mt={2}
      >
        <Typography
          color="text.secondary"
          sx={{
            alignSelf: "center",
            width: "100%",
            maxWidth: "1200px",
            fontSize: { xs: "8pt", md: "14pt" },
            textAlign: "justify",
          }}
        >
          <TextSlicer>
            نحن نؤمن في شركة شادي شري للهندسة والاستشارات بأن نجاحنا يعتمد على
            خبرات فريقنا ومهاراته المتميزة. نحن نقدم استشارات هندسية متكاملة في
            جميع التخصصات، ونسعى دائماً لتقديم أفضل الحلول لعملائنا. إذا كنت
            مهندساً محترفاً، ذو خبرة عالية، وشغوف بالإبداع الهندسي، فإننا ندعوك
            لابداء اهتمامك بالانضمام إلى فريقنا. نحن نبحث دائماً عن العقول
            المتميزة التي تستطيع أن تساهم في تطوير مشاريعنا وتحقيق رؤيتنا في
            تقديم استشارات هندسية عالية الجودة. من فضلك ، املأ الحقول بالاسفل ان
            كنت مهتما بان تصبح فردا من افراد عائلتنا وسنكون سعداء بالتواصل معك .
          </TextSlicer>
        </Typography>
        <JoinRequestForm />
      </Stack>
    </SectionContainer>
  );
};

export default JoinUs;
