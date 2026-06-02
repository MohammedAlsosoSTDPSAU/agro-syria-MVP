"use client";

import { motion } from "framer-motion";

interface AgroLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export function AgroLogo({ size = 40, animated = false, className }: AgroLogoProps) {
  const Wrapper = animated ? motion.svg : "svg";
  const wrapperProps = animated
    ? {
        initial: { scale: 0.8, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { duration: 0.6, ease: "easeOut" },
      }
    : {};

  return (
    <Wrapper
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...(wrapperProps as object)}
    >
      {/* Outer emerald ring */}
      <circle
        cx="20"
        cy="20"
        r="18"
        stroke="oklch(0.696 0.170 162)"
        strokeWidth="1.5"
        strokeOpacity="0.6"
      />
      {/* Inner glow circle */}
      <circle
        cx="20"
        cy="20"
        r="14"
        fill="oklch(0.696 0.170 162)"
        fillOpacity="0.8"
      />
      {/* Wheat stalk / leaf motif */}
      <path
        d="M20 30 L20 14"
        stroke="oklch(0.696 0.170 162)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 22 C18 20 15 20 14 18 C15 17 18 17 20 19"
        stroke="oklch(0.696 0.170 162)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 19 C22 17 25 17 26 15 C25 14 22 14 20 16"
        stroke="oklch(0.696 0.170 162)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Root/soil arc */}
      <path
        d="M15 30 Q20 28 25 30"
        stroke="oklch(0.696 0.170 162)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.7"
        fill="none"
      />
    </Wrapper>
  );
}
