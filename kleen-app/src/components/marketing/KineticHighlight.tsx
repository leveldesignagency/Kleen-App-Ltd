"use client";

type KineticHighlightProps = {
  children: React.ReactNode;
  className?: string;
  /** light = for text on dark gradient heroes */
  tone?: "default" | "light";
};

export default function KineticHighlight({
  children,
  className = "",
  tone = "default",
}: KineticHighlightProps) {
  const gradient =
    tone === "light"
      ? "from-white via-brand-200 to-accent-200"
      : "from-brand-600 via-accent-500 to-brand-600";

  return (
    <span
      className={[
        "kinetic-highlight bg-gradient-to-r bg-clip-text text-transparent",
        gradient,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
