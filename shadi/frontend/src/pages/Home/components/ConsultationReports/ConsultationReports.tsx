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
import { FC } from "react";
import SectionContainer from "../UI/SectionContainer";

const reports = [
  { href: report1, thumb: reportThumb1, name: "نموذج 01", meta: "8 صفحات · PDF · 958 كيلوبايت" },
  { href: report2, thumb: reportThumb2, name: "نموذج 02", meta: "7 صفحات · PDF · 958 كيلوبايت" },
  { href: report3, thumb: reportThumb3, name: "نموذج 03", meta: "7 صفحات · PDF · 958 كيلوبايت" },
  { href: report4, thumb: reportThumb4, name: "نموذج 04", meta: "3 صفحات · PDF · 958 كيلوبايت" },
  { href: report5, thumb: reportThumb5, name: "نموذج 05", meta: "5 صفحات · PDF · 958 كيلوبايت" },
  { href: report6, thumb: reportThumb6, name: "نموذج 06", meta: "5 صفحات · PDF · 958 كيلوبايت" },
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
          {reports.map((report) => (
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
                  borderRadius: { xs: 1.75, md: 2 },
                  overflow: "hidden",
                  backgroundColor: "#fff",
                  textDecoration: "none",
                  border: "1px solid rgba(90, 59, 37, 0.12)",
                  boxShadow: (theme) => `0 12px 28px ${alpha(theme.palette.common.black, 0.14)}`,
                }}
              >
                <Box
                  sx={{
                    width: "100%",
                    aspectRatio: "1.45",
                    overflow: "hidden",
                    backgroundColor: "#fff",
                    borderBottom: "2px solid #ff9f1a",
                  }}
                >
                  <Box
                    component="img"
                    src={report.thumb}
                    alt="معاينة الصفحة الأولى"
                    sx={{
                      display: "block",
                      width: "100%",
                      height: "auto",
                    }}
                  />
                </Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  dir="rtl"
                  sx={{
                    px: { xs: 0.9, md: 1.2 },
                    py: { xs: 0.75, md: 0.9 },
                    backgroundColor: "#ff9f1a",
                    justifyContent: "space-between",
                  }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: { xs: 23, md: 29 },
                      height: { xs: 25, md: 31 },
                      flex: "0 0 auto",
                      borderRadius: "4px",
                      background: "linear-gradient(180deg, #ef1d2f 0%, #c91626 100%)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: { xs: 8, md: 10 },
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                      boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.16)",
                    }}
                  >
                    PDF
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                    <Typography
                      sx={{
                        color: "#111",
                        fontWeight: 700,
                        fontSize: { xs: "8pt", sm: "9pt", md: "10.5pt" },
                        lineHeight: 1.15,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {report.name}
                    </Typography>
                    <Typography
                      sx={{
                        color: "#3f2b1d",
                        fontWeight: 500,
                        fontSize: { xs: "6.5pt", md: "8pt" },
                        lineHeight: 1.2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {report.meta}
                    </Typography>
                  </Box>
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
