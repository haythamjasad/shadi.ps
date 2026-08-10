import React, { useState } from "react";
import "./shadi-layout.css";

const DEFAULT_ASSETS = {
  logo: "/circle_logo_footer.png",
  visa: "/visa.png",
  mastercard: "/mastercard.png",
};

const SOCIAL_LINKS = [
  { key: "facebook", href: "https://www.facebook.com/share/1Fgc18pkRL/", label: "Facebook", icon: FacebookIcon },
  { key: "instagram", href: "https://www.instagram.com/shadi_shirri/", label: "Instagram", icon: InstagramIcon },
  { key: "tiktok", href: "https://www.tiktok.com/@shadishirri?_r=1&_t=ZS-91y8i3OcOJh", label: "TikTok", icon: TiktokIcon },
  { key: "whatsapp", href: "https://wa.me/+972568114114", label: "WhatsApp", icon: WhatsappIcon },
  { key: "email", href: "mailto:info@shadi.ps", label: "Email", icon: EmailIcon },
];

function FacebookIcon() {
  return <svg viewBox="0 0 24 24"><path d="M14.2 8.7V6.9c0-.7.5-.9.9-.9h2.2V2.2L14.2 2c-3.5 0-4.3 2.6-4.3 4.3v2.4H7v4.2h2.9V22h4.3v-9.1h3.4l.5-4.2h-3.9Z" /></svg>;
}

function InstagramIcon() {
  return <svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2" d="M7.5 2.8h9A4.7 4.7 0 0 1 21.2 7.5v9a4.7 4.7 0 0 1-4.7 4.7h-9a4.7 4.7 0 0 1-4.7-4.7v-9a4.7 4.7 0 0 1 4.7-4.7Z" /><path fill="none" stroke="currentColor" strokeWidth="2" d="M8.7 12a3.3 3.3 0 1 0 6.6 0 3.3 3.3 0 0 0-6.6 0Z" /><path d="M17.7 6.5a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z" /></svg>;
}

function TiktokIcon() {
  return <svg viewBox="0 0 24 24"><path d="M16.1 2c.3 2.6 1.8 4.2 4.5 4.4v4.1a7.8 7.8 0 0 1-4.4-1.4v6.8c0 8.7-9.5 11.4-13.3 5.2-2.5-4-.9-11 7-11.2v4.3c-.9.1-1.8.4-2.4 1.1-1.3 1.4-.9 3.9.9 4.7 1.7.8 3.8-.3 3.8-2.8V2h3.9Z" /></svg>;
}

function WhatsappIcon() {
  return <svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2" d="M4.2 19.8 5.4 16A8.3 8.3 0 1 1 8 18.6l-3.8 1.2Z" /><path d="M9 7.8c-.2-.4-.4-.4-.7-.4h-.6c-.2 0-.5.1-.8.4-.3.4-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3.2 5 4.3 2.4.9 3 .7 3.5.6.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4 0-.1-.2-.2-.5-.4l-1.9-.9c-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2.1-.4 0-.6L9 7.8Z" /></svg>;
}

function EmailIcon() {
  return <svg viewBox="0 0 24 24"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 8.2L4.7 7H19.3L12 13.2Zm-2.1.1L4 18h16l-5.9-4.7-2.1 1.8-2.1-1.8Z" /></svg>;
}

function PolicyDialog({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="ss-policy-backdrop" role="presentation" onClick={onClose}>
      <section className="ss-policy-dialog" role="dialog" aria-modal="true" aria-labelledby="ss-policy-title" dir="rtl" onClick={(event) => event.stopPropagation()}>
        <div className="ss-policy-header">
          <h2 id="ss-policy-title">سياسة الخصوصية والاسترجاع والاستبدال</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق">×</button>
        </div>
        <div className="ss-policy-body">
          <h3>الشروط والسياسات</h3>
          <p>الاستشارات المقدمة هي استشارات هندسية تقييمية وتوضيحية تعتمد على المشاهدات العينية الظاهرة، ولا تشمل أعمال التكسير أو الفحص المتخصص أو إعداد مخططات تنفيذية تفصيلية.</p>
          <p>قد تظهر الاستشارة وجود أخطاء تنفيذية أو تؤكد سلامة الأعمال الظاهرة، ولا تضمن الكشف عن جميع العيوب الخفية أو المستقبلية.</p>
          <p>يتم التعامل مع بيانات العملاء بسرية وتستخدم فقط لأغراض تقديم الخدمة والمتابعة وتحسين تجربة الاستخدام.</p>
        </div>
      </section>
    </div>
  );
}

export default function Footer({ assets = {}, className = "" }) {
  const mergedAssets = { ...DEFAULT_ASSETS, ...assets };
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <>
      <div className={`ss-footer-shell ${className}`} dir="rtl">
        <footer className="ss-footer-outer">
          <div className="ss-footer-inner">
            <div className="ss-mobile-accent-orange" />
            <div className="ss-mobile-accent-dark" />
            <div className="ss-mobile-corner" />
            <div className="ss-desktop-accent-orange" />
            <div className="ss-desktop-accent-dark" />
            <div className="ss-desktop-corner" />

            <div className="ss-desktop-logo-badge">
              <img src={mergedAssets.logo} alt="شعار شادي شرّي" />
            </div>

            <div className="ss-footer-spacer">
              <div className="ss-mobile-footer-row" dir="ltr">
                <div className="ss-mobile-footer-content">
                  <SocialRow />
                  <div className="ss-mobile-rights" dir="rtl">
                    جميع الحقوق محفوظة © شركة شادي شري للهندسة والاستشارات {year} |
                    <button type="button" onClick={() => setPoliciesOpen(true)}>اقرأ الشروط والسياسات</button>
                  </div>
                </div>
                <div className="ss-mobile-logo-badge">
                  <img src={mergedAssets.logo} alt="شعار شادي شرّي" />
                </div>
              </div>
            </div>

            <div className="ss-footer-content">
              <div className="ss-desktop-content" dir="rtl">
                <div className="ss-company-name">شركة شادي شري للهندسة والاستشارات</div>
                <div className="ss-desktop-meta-row" dir="ltr">
                  <SocialRow />
                  <div className="ss-payment-row">
                    <img src={mergedAssets.visa} alt="Visa" />
                    <img src={mergedAssets.mastercard} alt="MasterCard" />
                  </div>
                </div>
                <div className="ss-desktop-rights">
                  جميع الحقوق محفوظة © شركة شادي شري للهندسة والاستشارات {year} |
                  <button type="button" onClick={() => setPoliciesOpen(true)}>اقرأ الشروط والسياسات</button>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
      <PolicyDialog open={policiesOpen} onClose={() => setPoliciesOpen(false)} />
    </>
  );
}

function SocialRow() {
  return (
    <div className="ss-social-row">
      {SOCIAL_LINKS.map(({ key, href, label, icon: Icon }) => (
        <a key={key} className={`ss-social-link ss-social-link--${key}`} href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel={href.startsWith("mailto:") ? undefined : "noreferrer"} aria-label={label}>
          <Icon />
        </a>
      ))}
    </div>
  );
}
