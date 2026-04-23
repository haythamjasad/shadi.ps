import report1 from "@/assets/pdf/Sample 01.pdf";
import reportThumb1 from "@/assets/pdf/report-preview-1.jpg";
import report2 from "@/assets/pdf/Sample 02.pdf";
import reportThumb2 from "@/assets/pdf/report-preview-2.jpg";
import report3 from "@/assets/pdf/Sample 03.pdf";
import reportThumb3 from "@/assets/pdf/report-preview-3.jpg";
import report4 from "@/assets/pdf/Sample 04.pdf";
import reportThumb4 from "@/assets/pdf/report-preview-4.jpg";
import report5 from "@/assets/pdf/Sample 05.pdf";
import reportThumb5 from "@/assets/pdf/report-preview-5.jpg";
import report6 from "@/assets/pdf/Sample 6.pdf";
import reportThumb6 from "@/assets/pdf/report-preview-6.jpg";
import { alpha, Box, Grid2, Stack, Typography } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { FC } from "react";
import SectionContainer from "../UI/SectionContainer";

const reports = [
  { href: report1, thumb: reportThumb1, name: "Sample 01.pdf" },
  { href: report2, thumb: reportThumb2, name: "Sample 02.pdf" },
  { href: report3, thumb: reportThumb3, name: "Sample 03.pdf" },
  { href: report4, thumb: reportThumb4, name: "Sample 04.pdf" },
  { href: report5, thumb: reportThumb5, name: "Sample 05.pdf" },
  { href: report6, thumb: reportThumb6, name: "Sample 06.pdf" },
];

const ConsultationReports: FC = () => {
  return (
    <SectionContainer id="consultation_reports" py={0}>
      <Stack spacing={3} justifyContent="center" alignItems="center" sx={{ width: "100%", pt: 2, pb: 5 }}>
        <Typography
          sx={{
            width: "100%",
            fontSize: { xs: "7pt", sm: "10pt", md: "18pt" },
            fontWeight: "bold",
            textAlign: { xs: "left", md: "center" },
          }}
        >
          نعرض هنا نماذج من التقارير الفنية التي أُعدّت عقب زيارات هندسية ميدانية
        </Typography>

        <Grid2 container spacing={{ xs: 1.5, md: 2 }} justifyContent="center" dir="ltr" sx={{ width: "100%" }}>
          {reports.map((report, index) => (
            <Grid2 key={report.href} size={{ xs: 6, sm: 4, md: 2 }} sx={{ display: "flex", justifyContent: "center" }}>
              <Box
                component="a"
                href={report.href}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: "block",
                  width: "100%",
                  maxWidth: { xs: 180, sm: 200, md: 210 },
                  borderRadius: 2,
                  overflow: "hidden",
                  backgroundColor: "#fff",
                  boxShadow: (theme) => `
                    0 0 4px ${alpha(theme.palette.primary.main, 0.25)},
                    2px 3px 6px -1px ${alpha(theme.palette.primary.main, 0.35)},
                    8px 8px 20px -3px ${alpha(theme.palette.primary.main, 0.35)}
                  `,
                }}
              >
                <Box
                  component="img"
                  src={report.thumb}
                  alt={`first page preview ${index + 1}`}
                  sx={{
                    display: "block",
                    width: "100%",
                    height: { xs: 110, sm: 130, md: 150 },
                    objectFit: "cover",
                    objectPosition: "top center",
                    transition: "transform 200ms ease-in-out",
                    "&:hover": {
                      transform: "scale(1.02)",
                    },
                  }}
                />
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    px: { xs: 1, md: 1.5 },
                    py: { xs: 0.75, md: 1 },
                    background: "linear-gradient(180deg, #ffbd59 0%, #f8a01b 100%)",
                  }}
                >
                  <PictureAsPdfIcon sx={{ color: "#d91f26", fontSize: { xs: 24, md: 30 } }} />
                  <Typography
                    sx={{
                      color: "#111",
                      fontWeight: 500,
                      fontSize: { xs: "8pt", sm: "9pt", md: "11pt" },
                      lineHeight: 1.2,
                    }}
                  >
                    {report.name}
                  </Typography>
                </Stack>
              </Box>
            </Grid2>
          ))}
        </Grid2>
      </Stack>
    </SectionContainer>
  );
};

export default ConsultationReports;
