import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp, FaEnvelope } from 'react-icons/fa';
import visaIcon from '../assets/visa.png';
import mastercardIcon from '../assets/mastercard.png';

const Footer = () => {
  return (
    <footer className="bg-[#d9d9de] pt-0 pb-5 md:pt-0 md:pb-0">
      <div className="w-full">
        <div className="relative mb-[30px] flex flex-col items-center justify-between gap-4 overflow-hidden bg-white px-3 pt-3 pb-5 shadow-[0_16px_40px_rgba(0,0,0,0.08)] md:mb-0 md:flex-row md:items-start md:gap-6 md:px-8 md:pt-8 md:pb-12 md:shadow-[0_24px_60px_rgba(0,0,0,0.12)]">
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-[#F89C1C] md:hidden" />
          <div className="absolute bottom-3 left-0 right-0 h-1.5 bg-[#1f1f27] md:hidden" />
          <div className="absolute bottom-0 left-0 h-12 w-28 rounded-tr-[36px] bg-[#1f1f27] md:hidden" />
          <div className="hidden md:block absolute bottom-0 left-0 right-0 h-4 bg-[#F89C1C]" />
          <div className="hidden md:block absolute bottom-4 left-0 right-0 h-2 bg-[#1f1f27]" />
          <div className="hidden md:block absolute bottom-0 left-0 h-16 w-40 rounded-tr-[48px] bg-[#1f1f27]" />
          <div className="hidden md:flex absolute top-8 right-8 h-[150px] w-[150px] items-center justify-center overflow-hidden rounded-full border-[4px] border-[#F89C1C] bg-[#fafafa] shadow-inner z-10">
            <img src="/circle_logo_footer.png" alt="شعار شادي شرّي" className="h-full w-full object-contain" />
          </div>
          <div className="relative z-10 w-full md:w-1/2 order-1 md:order-1">
            <div className="flex w-full items-center justify-between gap-2 px-3 md:justify-start md:px-0" dir="ltr">
              <div className="md:hidden flex-1 flex flex-col items-start gap-1 pt-1">
                <div className="flex items-center gap-2 text-[17px] whitespace-nowrap">
                  <a href="https://www.facebook.com/share/1Fgc18pkRL/" target="_blank" rel="noreferrer" className="text-blue-600 hover:opacity-80" aria-label="Facebook"><FaFacebookF /></a>
                  <a href="https://www.instagram.com/shadi_shirri/" target="_blank" rel="noreferrer" className="text-pink-500 hover:opacity-80" aria-label="Instagram"><FaInstagram /></a>
                  <a href="https://www.tiktok.com/@shadishirri?_r=1&_t=ZS-91y8i3OcOJh" target="_blank" rel="noreferrer" className="text-black hover:opacity-80" aria-label="TikTok"><FaTiktok /></a>
                  <a href="https://wa.me/+972568114114" target="_blank" rel="noreferrer" className="text-green-500 hover:opacity-80" aria-label="WhatsApp"><FaWhatsapp /></a>
                  <a href="mailto:info@shadi.ps" className="text-red-500 hover:opacity-80" aria-label="Email"><FaEnvelope /></a>
                  <img src={visaIcon} alt="Visa" className="h-3.5 w-auto object-contain mr-1" loading="lazy" />
                  <img src={mastercardIcon} alt="MasterCard" className="h-3.5 w-auto object-contain" loading="lazy" />
                </div>
                <div className="text-right text-[11px] leading-4 text-gray-700" dir="rtl">
                  جميع الحقوق محفوظة © شركة شادي شري للهندسة والاستشارات 2026 | <Link className="text-[#F89C1C] hover:underline" to="/terms-of-service">اقرأ الشروط والسياسات</Link>
                </div>
              </div>
              <div className="md:hidden flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full border-[2px] border-[#F89C1C] bg-[#fafafa] shadow-inner shrink-0">
                <img src="/circle_logo_footer.png" alt="شعار شادي شرّي" className="h-full w-full object-contain" />
              </div>
            </div>
          </div>

          <div className="relative z-10 w-full md:w-1/2 flex flex-col items-center md:items-end md:justify-start md:self-start gap-3 order-2 md:order-2 md:pr-[180px]">
            <div className="hidden md:block w-full text-right" dir="rtl">
              <div className="text-[18px] font-bold leading-7 text-[#262231]">
                شركة شادي شري للهندسة والاستشارات
              </div>
              <div className="mt-1 text-[15px] text-[#262231]">
                مواد بناء وسباكة وعزل للمشاريع السكنية والتجارية
              </div>
            </div>

            <div className="hidden md:flex w-full items-center justify-end gap-4 whitespace-nowrap border-t border-[#d9d9de] pt-4">
              <div className="flex items-center justify-end gap-5 text-[30px]">
                <a href="https://www.facebook.com/share/1Fgc18pkRL/" target="_blank" rel="noreferrer" className="text-blue-600 hover:opacity-80" aria-label="Facebook"><FaFacebookF /></a>
                <a href="https://www.instagram.com/shadi_shirri/" target="_blank" rel="noreferrer" className="text-pink-500 hover:opacity-80" aria-label="Instagram"><FaInstagram /></a>
                <a href="https://www.tiktok.com/@shadishirri?_r=1&_t=ZS-91y8i3OcOJh" target="_blank" rel="noreferrer" className="text-black hover:opacity-80" aria-label="TikTok"><FaTiktok /></a>
                <a href="https://wa.me/+972568114114" target="_blank" rel="noreferrer" className="text-green-500 hover:opacity-80" aria-label="WhatsApp"><FaWhatsapp /></a>
                <a href="mailto:info@shadi.ps" className="text-red-500 hover:opacity-80" aria-label="Email"><FaEnvelope /></a>
              </div>
              <div className="flex items-center gap-3 pr-2">
                <img src={visaIcon} alt="Visa" className="h-7 w-auto object-contain" loading="lazy" />
                <img src={mastercardIcon} alt="MasterCard" className="h-7 w-auto object-contain" loading="lazy" />
              </div>
            </div>

            <div className="hidden md:block max-w-[34rem] text-right text-[15px] md:text-[16px] text-gray-700" dir="rtl">
              جميع الحقوق محفوظة © شركة شادي شري للهندسة والاستشارات 2026 | <Link className="text-orange-500 hover:underline" to="/terms-of-service">اقرأ الشروط والسياسات</Link>
            </div>

          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
