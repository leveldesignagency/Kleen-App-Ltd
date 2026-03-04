import Image from "next/image";
import { CreditCard } from "lucide-react";

const BRAND_LOGOS: Record<string, { src: string; alt: string }> = {
  visa:        { src: "/images/cards/card_visa.svg",             alt: "Visa" },
  mastercard:  { src: "/images/cards/card_mastercard.svg",       alt: "Mastercard" },
  amex:        { src: "/images/cards/card_american-express.svg", alt: "American Express" },
  maestro:     { src: "/images/cards/card_maestro.svg",          alt: "Maestro" },
  discover:    { src: "/images/cards/card_discover.svg",         alt: "Discover" },
  diners:      { src: "/images/cards/card_diners_club.svg",      alt: "Diners Club" },
  jcb:         { src: "/images/cards/card_jcb.svg",              alt: "JCB" },
  unionpay:    { src: "/images/cards/card_unionpay.svg",         alt: "UnionPay" },
  paypal:      { src: "/images/cards/card_paypal.svg",           alt: "PayPal" },
  klarna:      { src: "/images/cards/card_klarna.svg",           alt: "Klarna" },
  apple_pay:   { src: "/images/cards/card_apple-pay.svg",        alt: "Apple Pay" },
  google_pay:  { src: "/images/cards/card_google-pay.svg",       alt: "Google Pay" },
};

export default function CardBrandLogo({
  brand,
  className = "h-8 w-auto",
}: {
  brand?: string;
  className?: string;
}) {
  const logo = brand ? BRAND_LOGOS[brand] : null;

  if (!logo) {
    return <CreditCard className={className} />;
  }

  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={48}
      height={30}
      className={className}
    />
  );
}
