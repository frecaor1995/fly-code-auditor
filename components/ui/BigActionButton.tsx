"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-fly-gold text-fly-black hover:bg-fly-goldlight",
  secondary: "bg-fly-charcoal text-fly-white border border-fly-gray hover:border-fly-gold",
  danger: "bg-risk-critical text-white hover:brightness-110",
  ghost: "bg-transparent text-fly-white border border-fly-gray hover:border-fly-gold"
};

export function BigActionButton({ children, variant = "primary", icon, className = "", ...rest }: Props) {
  return (
    <button
      className={`flex items-center justify-center gap-2 min-h-[3.25rem] w-full rounded-xl px-5 py-3 text-base font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
