import personPhoto6 from "@/assets/images/person10.jpg";
import personPhoto from "@/assets/images/person5.jpg";
import personPhoto2 from "@/assets/images/person6.jpg";
import personPhoto5 from "@/assets/images/person7.jpg";
import personPhoto3 from "@/assets/images/person9.jpg";
import personPhoto4 from "@/assets/images/person4.jpg";
import report1 from "@/assets/pdf/Sample 01.pdf";
import report2 from "@/assets/pdf/Sample 02.pdf";
import report3 from "@/assets/pdf/Sample 03.pdf";
import report4 from "@/assets/pdf/Sample 04.pdf";
import report5 from "@/assets/pdf/Sample 05.pdf";
import report6 from "@/assets/pdf/Sample 6.pdf";
import {
  alpha,
  Box,
  Grid2,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { logoColor } from "@/style/colors";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FC, TouchEvent, useEffect, useRef, useState } from "react";
import SectionContainer from "../UI/SectionContainer";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";

const REPORT_CARD_GAP = 12;
const REPORT_AUTO_SCROLL_MS = 2600;
const REPORT_SWIPE_THRESHOLD = 40;

const OurServices: FC = () => {
  const images = [
    personPhoto,
    personPhoto2,
    personPhoto3,
    personPhoto5,
    personPhoto6,
    personPhoto4,
  ];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const autoPlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportsViewportRef = useRef<HTMLDivElement | null>(null);
  const reportsSetRef = useRef<HTMLDivElement | null>(null);
  const reportsAutoPlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportsTouchStartXRef = useRef<number | null>(null);
  const reportsTouchStartYRef = useRef<number | null>(null);
  const [prevImageIndex, setPrevImageIndex] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [reportStep, setReportStep] = useState(0);
  const [reportIndex, setReportIndex] = useState(5);
  const [reportsTransitionEnabled, setReportsTransitionEnabled] = useState(true);
  const [reportsAutoPlay, setReportsAutoPlay] = useState(true);
  const [reportThumbs, setReportThumbs] = useState<Record<string, string>>({});

  GlobalWorkerOptions.workerSrc = pdfjsWorker;

  const reports = [
    { href: report1 },
    { href: report2 },
    { href: report3 },
    { href: report4 },
    { href: report5 },
    { href: report6 },
  ];
  const loopedReports = [...reports, ...reports, ...reports];
  const services = [
    {
      title: "التقييم الهندسي للأعمال المنفذة:",
      description:
        "تقييم محايد للأعمال على أرض الواقع للتحقق من مطابقتها للمخططات والمواصفات والكودات، مع اتخاذ القرار المناسب (قبول، معالجة، أو رفض).",
    },
    {
      title: "الزيارات والإشراف الهندسي:",
      description:
        "زيارات هندسية تقيمية إرشادية لمرة واحدة أو إشراف هندسي دوري لمتابعة جودة التنفيذ والمواد وضمان الالتزام بالتصاميم والمعايير المعتمدة.",
    },
    {
      title: "إدارة المشاريع الهندسية:",
      description:
        "إدارة وتنسيق مراحل المشروع من حيث الوقت والتكلفة والجودة، ومتابعة التنفيذ وإدارة المخاطر لتحقيق أهداف المشروع بكفاءة.",
    },
    {
      title: "تمثيل المالك:",
      description:
        "تمثيل المالك فنياً أمام المقاولين والاستشاريين والموردين، متابعة التنفيذ نيابة عنه، واتخاذ القرارات الهندسية الصحيحة لحماية استثماره وتقليل الأخطاء.",
    },
  ];

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  const handlePrevious = () => {
    pauseAutoPlay();
    setPrevImageIndex(currentImageIndex);
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setIsTransitioning(true);
    setTimeout(() => {
      setIsTransitioning(false);
      setPrevImageIndex(null);
    }, 600);
  };

  const handleNext = () => {
    pauseAutoPlay();
    setPrevImageIndex(currentImageIndex);
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setIsTransitioning(true);
    setTimeout(() => {
      setIsTransitioning(false);
      setPrevImageIndex(null);
    }, 600);
  };

  const pauseAutoPlay = (duration = 8000) => {
    setAutoPlay(false);
    if (autoPlayTimeoutRef.current) clearTimeout(autoPlayTimeoutRef.current);
    autoPlayTimeoutRef.current = setTimeout(() => setAutoPlay(true), duration);
  };

  const measureReportsCarousel = () => {
    const setNode = reportsSetRef.current;
    if (!setNode) return;

    const firstCard = setNode.querySelector("[data-report-card='true']") as HTMLElement | null;
    if (firstCard) {
      const styles = window.getComputedStyle(setNode);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || `${REPORT_CARD_GAP}`);
      setReportStep(firstCard.offsetWidth + gap);
    }
  };

  const pauseReportsAutoPlay = (duration = 8000) => {
    setReportsAutoPlay(false);
    if (reportsAutoPlayTimeoutRef.current) {
      clearTimeout(reportsAutoPlayTimeoutRef.current);
    }
    reportsAutoPlayTimeoutRef.current = setTimeout(() => setReportsAutoPlay(true), duration);
  };

  useEffect(() => {
    let canceled = false;

    const renderThumbnails = async () => {
      const entries: Array<[string, string]> = [];

      for (const report of reports) {
        try {
          const loadingTask = getDocument(report.href);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1 });
          const targetWidth = 220;
          const scale = targetWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) continue;
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
          const dataUrl = canvas.toDataURL("image/png");
          entries.push([report.href, dataUrl]);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to render PDF thumbnail", error);
        }
      }

      if (!canceled) {
        setReportThumbs((prev) => {
          const updated = { ...prev };
          for (const [href, dataUrl] of entries) {
            updated[href] = dataUrl;
          }
          return updated;
        });
      }
    };

    renderThumbnails();

    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReportsTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    reportsTouchStartXRef.current = touch.clientX;
    reportsTouchStartYRef.current = touch.clientY;
    pauseReportsAutoPlay(12000);
  };

  const handleReportsTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    if (reportsTouchStartXRef.current === null || reportsTouchStartYRef.current === null) return;

    const deltaX = Math.abs(touch.clientX - reportsTouchStartXRef.current);
    const deltaY = Math.abs(touch.clientY - reportsTouchStartYRef.current);

    if (deltaX > deltaY && deltaX > 6) {
      event.preventDefault();
    }
  };

  const handleReportsTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch || reportsTouchStartXRef.current === null || reportsTouchStartYRef.current === null) {
      reportsTouchStartXRef.current = null;
      reportsTouchStartYRef.current = null;
      return;
    }

    const deltaX = touch.clientX - reportsTouchStartXRef.current;
    const deltaY = Math.abs(touch.clientY - reportsTouchStartYRef.current);

    if (Math.abs(deltaX) > REPORT_SWIPE_THRESHOLD && Math.abs(deltaX) > deltaY) {
      setReportIndex((current) => current + (deltaX < 0 ? 1 : -1));
    }

    reportsTouchStartXRef.current = null;
    reportsTouchStartYRef.current = null;
    pauseReportsAutoPlay(8000);
  };

  const handleTouchStart = (e: any) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchEndX.current = null;
    touchEndY.current = null;
  };

  const handleTouchMove = (e: any) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    touchEndX.current = touch.clientX;
    touchEndY.current = touch.clientY;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const deltaX = (touchEndX.current ?? 0) - (touchStartX.current ?? 0);
    const deltaY = Math.abs(
      (touchEndY.current ?? 0) - (touchStartY.current ?? 0),
    );
    const threshold = 50;

    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > deltaY) {
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrevious();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    touchEndY.current = null;
  };

  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) =>
        prev === images.length - 1 ? 0 : prev + 1,
      );
    }, 1500);
    return () => clearInterval(interval);
  }, [images.length, autoPlay]);

  useEffect(() => {
    return () => {
      if (autoPlayTimeoutRef.current) clearTimeout(autoPlayTimeoutRef.current);
      if (reportsAutoPlayTimeoutRef.current) clearTimeout(reportsAutoPlayTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    measureReportsCarousel();

    const timeout = window.setTimeout(measureReportsCarousel, 250);
    const handleResize = () => measureReportsCarousel();

    window.addEventListener("resize", handleResize);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!reportsAutoPlay) return;

    const interval = window.setInterval(() => {
      setReportIndex((current) => current + 1);
    }, REPORT_AUTO_SCROLL_MS);

    return () => window.clearInterval(interval);
  }, [reportsAutoPlay]);

  useEffect(() => {
    if (!reportsTransitionEnabled) {
      const frame = requestAnimationFrame(() => setReportsTransitionEnabled(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [reportsTransitionEnabled]);
  return (
    <SectionContainer id="our_services">
      <Grid2 container spacing={2} justifyContent="center" alignItems="center">
        <Grid2 size={{ xs: 12, sm: 12, md: 6 }}>
          <Stack
            spacing={1}
            justifyContent="flex-start"
            height="100%"
            alignItems="center"
            pt={{ xs: 1, md: 2 }}
          >
            <Typography
              sx={() => ({
                color: logoColor,
                width: "100%",
                fontSize: { xs: "16pt", md: "38pt" },
                fontWeight: "bold",
                textAlign: { xs: "left", md: "center" },
                paddingBottom: 1,
                paddingTop: 1,
                position: "relative",
                display: "inline-flex",
                justifyContent: { xs: "flex-start", md: "center" },
                pb: 2,
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: 0,
                  width: { xs: 100, md: 130 },
                  height: 4,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, rgba(248,160,27,0.2), rgba(248,160,27,0.9), rgba(248,160,27,0.2))",
                },
              })}
            >
              الخدمات
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                pb: 2,
                alignSelf: "center",
                width: "100%",
                maxWidth: "1450px",
                fontSize: { xs: "10pt", md: "14pt" },
                textAlign: "justify",
                p: { xs: 2, md: 3 },
                borderRadius: 4,
                background: "linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.44))",
                border: "1px solid rgba(58,55,65,0.08)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 18px 40px rgba(58,55,65,0.06)",
                lineHeight: { xs: 2, md: 2.1 },
              }}
            >
              نقدّم مجموعة متكاملة من الخدمات الهندسية المتخصصة، والمبيّنة
              أدناه، بما يوضّح نطاق أعمالنا ومسؤولياتنا الفنية:
              
              
              <Box sx={{ mt: 2, width: "100%", maxWidth: "1450px" }}>
                {services.map((service, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 1,
                      pb: 1,
                      borderBottom: index !== services.length - 1 ? "1px solid" : "none",
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                    component="strong"
                      sx={{
                        fontSize: { xs: "10pt", md: "14pt" },
                        color: "black",
                        fontWeight: "bold",
                      }}
                    >
                      {index + 1}. {service.title}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: "10pt", md: "12pt" },
                        color: "text.secondary",
                        textAlign: "justify",
                      }}
                    >
                      {service.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Typography>
          </Stack>
        </Grid2>

        <Grid2 sx={{ py: 2 }} size={{ xs: 12, sm: 12, md: 6 }}>
          <Stack
            justifyContent="center"
            alignItems="center"
            height="100%"
            position="relative"
            mt={{ xs: 1, md: 2 }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <IconButton
              onClick={handlePrevious}
              sx={{
                position: "absolute",
                left: 0,
                zIndex: 1,
                bgcolor: "none",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <ChevronRight />
            </IconButton>
            <Box
              sx={(theme) => ({
                position: "relative",
                width: "100%",
                maxWidth: "600px",
                aspectRatio: "1 / 0.75",
                overflow: "hidden",
                borderRadius: "40px",
                objectFit: "fill",
                border: "1px solid rgba(255,255,255,0.68)",
                boxShadow: `0 28px 70px ${alpha(theme.palette.primary.main, 0.18)}, 0 10px 22px ${alpha(theme.palette.common.black, 0.08)}`,
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(23,21,28,0.02), rgba(23,21,28,0.14))",
                  zIndex: 1,
                  pointerEvents: "none",
                },
              })}
            >
              {prevImageIndex !== null && (
                <Box
                  component="img"
                  src={images[prevImageIndex]}
                  width="100%"
                  height="100%"
                  alt="previous"
                  sx={() => ({
                    position: "absolute",
                    top: 0,
                    left: 0,
                    borderRadius: "40px",
                    objectFit: "fill",
                    transition: "transform 400ms ease-in-out",
                    transform: isTransitioning
                      ? "translateX(-100%)"
                      : "translateX(0)",
                  })}
                />
              )}

              <Box
                component="img"
                src={images[currentImageIndex]}
                width="100%"
                height="100%"
                alt="current"
                sx={() => ({
                   position: prevImageIndex !== null ? "absolute" : "relative",
                   top: 0,
                   left: 0,
                   borderRadius: "40px",
                    objectFit: "cover",
                  transition: "transform 400ms ease-in-out",
                  transform:
                    prevImageIndex !== null
                      ? isTransitioning
                        ? "translateX(0)"
                        : "translateX(100%)"
                      : "translateX(0)",
                })}
              />
            </Box>
            <IconButton
              onClick={handleNext}
              sx={{
                position: "absolute",
                right: 0,
                zIndex: 1,
                bgcolor: "none",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <ChevronLeft />
            </IconButton>
          </Stack>
        </Grid2>

        <Grid2 size={{ xs: 12 }}>
          <Stack
            spacing={1.25}
            justifyContent="center"
            height="100%"
            alignItems="center"
            sx={{ textAlign: "center", mt: { xs: 1, md: 2 } }}
          >
            <Box
              sx={{
                px: 2,
                py: 0.5,
                borderRadius: 999,
                border: "1px solid rgba(248,160,27,0.35)",
                background: "linear-gradient(135deg, rgba(248,160,27,0.18), rgba(248,160,27,0.05))",
                color: "#7a4a00",
                fontWeight: 800,
                fontSize: { xs: "8pt", md: "10pt" },
                letterSpacing: 0.2,
              }}
            >
              تقارير ميدانية حقيقية
            </Box>
            <Typography
              sx={{
                width: "100%",
                fontSize: { xs: "11pt", sm: "13pt", md: "22pt" },
                fontWeight: 800,
                color: "#1d1b22",
              }}
            >
              نماذج من التقارير الفنية بعد زيارات هندسية ميدانية
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                width: "100%",
                maxWidth: "760px",
                fontSize: { xs: "8.5pt", md: "11pt" },
                lineHeight: 1.95,
              }}
            >
              كل بطاقة تمثل تقريرا هندسيا فعليا يوضح آلية الرصد والتحليل والتوصيات قبل اتخاذ القرار في الموقع.
            </Typography>
          </Stack>
        </Grid2>

        <Grid2 size={{ xs: 12 }}>
          <Stack spacing={2} justifyContent="center" alignItems="center" sx={{ width: "100%" }}>
            <Box
              sx={{
                width: "100%",
                maxWidth: "95vw",
                overflow: "hidden",
                borderRadius: 5,
                p: { xs: 1.25, md: 2 },
                background: "linear-gradient(145deg, rgba(255,255,255,0.86), rgba(255,255,255,0.62))",
                border: "1px solid rgba(58,55,65,0.08)",
                boxShadow: "0 22px 46px rgba(58,55,65,0.08)",
              }}
            >
              <Box
                ref={reportsViewportRef}
                dir="ltr"
                onMouseEnter={() => pauseReportsAutoPlay(12000)}
                onTouchStart={handleReportsTouchStart}
                onTouchMove={handleReportsTouchMove}
                onTouchEnd={handleReportsTouchEnd}
                onWheel={() => pauseReportsAutoPlay(12000)}
                sx={{
                  overflow: "hidden",
                  py: 1,
                  touchAction: "pan-y",
                }}
              >
                <Box
                  ref={reportsSetRef}
                  onTransitionEnd={() => {
                    const reportsCount = reports.length;
                    if (reportIndex >= reportsCount * 2) {
                      setReportsTransitionEnabled(false);
                      setReportIndex(reportsCount);
                    } else if (reportIndex < reportsCount) {
                      setReportsTransitionEnabled(false);
                      setReportIndex((reportsCount * 2) - 1);
                    }
                  }}
                  sx={{
                    display: "flex",
                    gap: `${REPORT_CARD_GAP}px`,
                    width: "max-content",
                    transform: reportStep
                      ? `translate3d(-${reportIndex * reportStep}px, 0, 0)`
                      : "translate3d(0, 0, 0)",
                    transition: reportsTransitionEnabled ? "transform 420ms ease" : "none",
                    willChange: "transform",
                  }}
                >
                  {loopedReports.map((r, index) => (
                    <Box key={`report-${index}`} sx={{ flex: "0 0 auto" }}>
                      <Box
                        data-report-card="true"
                        component="a"
                        href={r.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: "block",
                          width: { xs: 132, sm: 172, md: 220 },
                          borderRadius: 3,
                          overflow: "hidden",
                          border: "1px solid rgba(28,27,31,0.16)",
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,249,246,0.96))",
                          boxShadow: (theme) =>
                            `0 14px 28px ${alpha(theme.palette.common.black, 0.12)}, 0 4px 14px ${alpha(theme.palette.primary.main, 0.14)}`,
                          transform: `translateY(${index % 2 === 0 ? "0" : "10px"}) rotate(${((index % 3) - 1) * 1.2}deg)`,
                          transformOrigin: "50% 95%",
                          transition: "transform 280ms ease, box-shadow 280ms ease",
                          "&:hover": {
                            transform: "translateY(-8px) rotate(0deg)",
                            boxShadow: (theme) =>
                              `0 24px 48px ${alpha(theme.palette.common.black, 0.16)}, 0 10px 20px ${alpha(theme.palette.primary.main, 0.18)}`,
                          },
                        }}
                      >
                        <Box
                          component="img"
                          src={
                            reportThumbs[r.href] ||
                            "data:image/svg+xml;charset=utf-8," +
                              encodeURIComponent(
                                `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='260'><rect width='100%' height='100%' fill='%23f6f6f6'/><text x='50%' y='50%' fill='%23666' font-size='12' font-family='Arial' text-anchor='middle'>جاري التحميل...</text></svg>`,
                              )
                          }
                          alt={`Report ${(index % reports.length) + 1} first page`}
                          sx={{
                            display: "block",
                            width: { xs: 132, sm: 172, md: 220 },
                            height: { xs: 180, sm: 220, md: 260 },
                            objectFit: "contain",
                            backgroundColor: "#f6f6f6",
                          }}
                        />
                        <Box
                          sx={{
                            px: 1.1,
                            py: 0.8,
                            borderTop: "1px solid rgba(58,55,65,0.08)",
                            background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.82))",
                            color: "#4b4656",
                            fontSize: { xs: "7pt", md: "8pt" },
                            textAlign: "center",
                            fontWeight: 700,
                          }}
                        >
                          تقرير {(index % reports.length) + 1}
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Stack>
        </Grid2>
      </Grid2>
    </SectionContainer>
  );
};

export default OurServices;
