"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface RelativeTimeProps {
  isoDate: string;
  className?: string;
}

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 30)  return "الآن";
  if (diff < 90)  return "منذ دقيقة";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 7200) return "منذ ساعة";
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

export function RelativeTime({ isoDate, className = "" }: RelativeTimeProps) {
  const [label, setLabel] = useState(() => formatRelative(isoDate));

  useEffect(() => {
    setLabel(formatRelative(isoDate));
    const id = setInterval(() => setLabel(formatRelative(isoDate)), 30_000);
    return () => clearInterval(id);
  }, [isoDate]);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} dir="rtl">
      <Clock className="w-3 h-3 opacity-60 flex-shrink-0" />
      {label}
    </span>
  );
}
