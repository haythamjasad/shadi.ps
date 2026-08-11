import EmailIcon from "@mui/icons-material/Email";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { Stack } from "@mui/material";
import { FC } from "react";
import { FaTiktok } from "react-icons/fa";
import { ContactUsLinkProps } from "../AppointmentForm/types";

const ContactUsLink: FC<ContactUsLinkProps> = (props) => {
  return (
    <>
      <a
        href="https://www.facebook.com/share/1Fgc18pkRL/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div style={{ transform: "scaleX(-1)" }}>
          <FacebookIcon
            sx={{
              marginTop: "3px",
              color: "#1877F2",
              fontSize: { xs: props.xs, sm: props.sm, md: props.md },
              marginInline: "0",
            }}
          />
        </div>
      </a>
      <a
        href="https://www.instagram.com/shadi_shirri/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div style={{ transform: "scaleX(-1)" }}>
          <InstagramIcon
            sx={{
              marginTop: "3px",
              color: "#E4405F",
              fontSize: { xs: props.xs, sm: props.sm, md: props.md },
            }}
          />
        </div>
      </a>
      <a
        href="https://www.tiktok.com/@shadishirri?_r=1&_t=ZS-91y8i3OcOJh"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Stack
          sx={{
            color: "#000000",
            fontSize: { xs: props.xs, sm: props.sm, md: props.md },
          }}
          justifyContent="center"
          alignItems="center"
          height="100%"
        >
          <FaTiktok style={{ width: "80%", height: "auto" }} />
        </Stack>
      </a>
      <a
        href="https://wa.me/+972568114114"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div style={{ transform: "scaleX(-1)" }}>
          <WhatsAppIcon
            sx={{
              marginTop: "3px",
              color: "#25D366",
              fontSize: { xs: props.xs, sm: props.sm, md: props.md },
            }}
          />
        </div>
      </a>
      <a href="mailto:info@shadi.ps" target="_blank" rel="noopener noreferrer">
        <div style={{ transform: "scaleX(-1)" }}>
          <EmailIcon
            sx={{
              marginTop: "3px",
              color: "#D44638",
              fontSize: { xs: props.xs, sm: props.sm, md: props.md },
              marginInline: "0",
            }}
          />
        </div>
      </a>
    </>
  );
};

export default ContactUsLink;
