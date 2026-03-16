"use client";

import Link from "next/link";

type Variant = "primary" | "secondary" | "accent";

interface SwipeButtonBaseProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

interface SwipeButtonAsButton
  extends SwipeButtonBaseProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  href?: undefined;
}

interface SwipeButtonAsLink extends SwipeButtonBaseProps {
  href: string;
  onClick?: () => void;
}

type SwipeButtonProps = SwipeButtonAsButton | SwipeButtonAsLink;

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  accent: "btn-accent",
};

export default function SwipeButton({
  variant = "primary",
  children,
  className = "",
  ...props
}: SwipeButtonProps) {
  const classes = `${VARIANT_CLASS[variant]} ${className}`;

  if ("href" in props && props.href) {
    const { href, onClick, ...rest } = props as SwipeButtonAsLink;
    return (
      <Link href={href} className={classes} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }

  const { ...buttonProps } = props as SwipeButtonAsButton;
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
