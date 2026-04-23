import personPhoto6 from "@/assets/images/person10.jpg";
import personPhoto from "@/assets/images/person5.jpg";
import personPhoto2 from "@/assets/images/person6.jpg";
import personPhoto5 from "@/assets/images/person7.jpg";
import personPhoto3 from "@/assets/images/person9.jpg";
import personPhoto4 from "@/assets/images/person4.jpg";
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
import { FC, useEffect, useRef, useState } from "react";
import SectionContainer from "../UI/SectionContainer";
// import NumberedExpandableList from "../UI/NumberedExpandableList";

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
  const [prevImageIndex, setPrevImageIndex] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
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
    const threshold = 50; // minimum horizontal movement to count as swipe

    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > deltaY) {
      if (deltaX < 0) {
        // swipe left → next image
        handleNext();
      } else {
        // swipe right → previous image
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
    };
  }, []);

  return (
    <SectionContainer id="our_services">
      <Grid2 container spacing={2} justifyContent="center" alignItems="flex-start">
        <Grid2 size={{ xs: 12, sm: 12, md: 6 }}>
          <Stack
            spacing={1}
            justifyContent="flex-start"
            height="100%"
            alignItems="center"
            pt={{ xs: 1, md: 2 }}
          >
            {/* <SectionTitle logo={<HandymanIcon style={{ fontSize: "50px" }} />}>
             خدماتنا
             </SectionTitle> */}
            <Typography
              sx={() => ({
                color: logoColor,
                width: "100%",
                fontSize: { xs: "16pt", md: "38pt" },
                fontWeight: "bold",
                textAlign: { xs: "left", md: "center" },
                paddingBottom: 1,
                paddingTop: 1,
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
                borderRadius: "10%",
                objectFit: "fill",
                boxShadow: `
                  0 0 4px ${alpha(theme.palette.primary.main, 0.25)},
                  2px 3px 6px -1px ${alpha(theme.palette.primary.main, 0.35)},
                  8px 8px 20px -3px ${alpha(theme.palette.primary.main, 0.35)}
                `,
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
                    borderRadius: "10%",
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
                  borderRadius: "10%",
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
      </Grid2>
    </SectionContainer>
  );
};

export default OurServices;
