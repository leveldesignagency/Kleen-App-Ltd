import MarketingPageHero from "@/components/marketing/MarketingPageHero";
import FAQAccordion from "@/components/marketing/FAQAccordion";

export default function FAQPage() {
  return (
    <>
      <MarketingPageHero
        badge="Got questions?"
        title="Frequently asked questions"
        description="Everything you need to know about booking, pricing, and quality on KLEEN."
      />
      <FAQAccordion />
    </>
  );
}
