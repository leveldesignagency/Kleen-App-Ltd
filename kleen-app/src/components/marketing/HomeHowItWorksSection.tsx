"use client";

import { Calculator, CheckCircle2, ClipboardList, Route } from "lucide-react";
import HomeFeatureCardsSection from "@/components/marketing/HomeFeatureCardsSection";

const STATS = [
  { value: "2 min", label: "Average quote time" },
  { value: "100%", label: "Transparent pricing" },
  { value: "Live", label: "Job tracking" },
  { value: "0", label: "Hidden fees" },
];

type HomeHowItWorksSectionProps = {
  jobFlowHref: string;
};

export default function HomeHowItWorksSection({ jobFlowHref }: HomeHowItWorksSectionProps) {
  const steps = [
    {
      icon: ClipboardList,
      title: "Tell us what you need",
      description:
        "Choose your service and customise the details — rooms, surfaces, and add-ons.",
      href: jobFlowHref,
      linkLabel: "Learn more",
    },
    {
      icon: Calculator,
      title: "Get an instant quote",
      description:
        "See real-time pricing based on your requirements. No waiting, no callbacks.",
      href: jobFlowHref,
      linkLabel: "Learn more",
    },
    {
      icon: Route,
      title: "Confirm & relax",
      description: "We handle the rest — track your operative live from your dashboard.",
      href: jobFlowHref,
      linkLabel: "Learn more",
    },
  ];

  return (
    <HomeFeatureCardsSection
      badgeIcon={CheckCircle2}
      badgeLabel="How it works"
      title="Three simple steps to a"
      titleHighlight="cleaner space"
      description="From first click to finished job — instant quotes, vetted professionals, and live tracking built in."
      cards={steps}
      stats={STATS}
      cta={{ href: jobFlowHref, label: "Get your free quote" }}
    />
  );
}
