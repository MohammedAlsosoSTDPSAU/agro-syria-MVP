"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  LayoutDashboard,
  Map,
  Sprout,
  CloudSun,
  TrendingUp,
  Users,
  Newspaper,
  Settings,
  HelpCircle,
  ChevronLeft,
  Bot,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeController";

export interface NavItem {
  id: string;
  labelAr: string;
  icon: React.ElementType;
  badge?: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", labelAr: "لوحة التحكم",     icon: LayoutDashboard, href: "/dashboard" },
  { id: "assistant", labelAr: "المساعد الزراعي", icon: Bot,             href: "/copilot" },
  { id: "fields",    labelAr: "حقولي",           icon: Map,             href: "/fields",    badge: "9" },
  { id: "crops",     labelAr: "المحاصيل",        icon: Sprout,          href: "/crops" },
  { id: "weather",   labelAr: "الطقس",           icon: CloudSun,        href: "/weather" },
  { id: "market",    labelAr: "لوحة السوق",       icon: TrendingUp,      href: "/dashboard/market", badge: "جديد" },
  { id: "community", labelAr: "المجتمع",          icon: Users,           href: "/community" },
  { id: "news",      labelAr: "الأخبار الزراعية", icon: Newspaper,       href: "/news",      badge: "قريباً" },
];

export const BOTTOM_ITEMS: NavItem[] = [
  { id: "about",    labelAr: "حول المنصة", icon: Info,       href: "/about"              },
  { id: "settings", labelAr: "الإعدادات", icon: Settings,    href: "/dashboard/settings" },
  { id: "help",     labelAr: "المساعدة",  icon: HelpCircle, href: "/dashboard/help"     },
];


interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

function NavButton({ item, isActive, isCollapsed, onClick }: NavButtonProps) {
  const Icon = item.icon;
  const isRealRoute = item.href !== "#";

  const inner = (
    <>
      {isActive && (
        <>
          <motion.span
            layoutId="nav-indicator"
            className="absolute inset-0 rounded-xl bg-emerald-500/12 border border-emerald-500/30 shadow-[inset_0_0_14px_oklch(0.696_0.170_162/_7%)]"
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          />
          <span className="absolute inset-y-2 end-0 w-0.5 rounded-full bg-emerald-400/65" />
        </>
      )}
      <span
        className={cn(
          "relative z-10 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200",
          isActive
            ? "bg-emerald-500/20 ring-1 ring-emerald-400/40"
            : "group-hover:bg-white/[0.05]"
        )}
      >
        <Icon
          className={cn(
            "w-4 h-4 transition-colors duration-200",
            isActive ? "text-emerald-400" : "text-current"
          )}
        />
      </span>
      {!isCollapsed && (
        <span className="text-sm font-medium relative z-10 flex-1 truncate">
          {item.labelAr}
        </span>
      )}
      {!isCollapsed && item.badge && (
        <span className="relative z-10 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {item.badge}
        </span>
      )}
    </>
  );

  const cls = cn(
    "group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
    "transition-all duration-200 text-start",
    isActive
      ? "bg-emerald-500/15 text-emerald-400 emerald-glow-sm"
      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
  );

  if (isRealRoute) {
    return (
      <Link href={item.href} onClick={onClick} className={cls}>
        {inner}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

interface SidebarProps {
  activeId?: string;
  onNavigate?: (id: string) => void;
}

export function Sidebar({ activeId = "dashboard", onNavigate = () => {} }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="h-full glass-sidebar flex flex-col flex-shrink-0 overflow-hidden hidden md:flex"
    >
      {/* Brand — full logo when expanded (h:60px), emblem mark when collapsed */}
      <div className="flex items-center justify-center px-3 py-4 border-b border-emerald-500/10">
        <motion.img
          key={collapsed ? "mark" : "full"}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          src={collapsed ? "/assets/agro-syria-mark.svg" : "/assets/agro-syria-logo.svg"}
          alt="أغرو-سوريا"
          draggable={false}
          className={cn("w-auto select-none", collapsed ? "h-9" : "h-[60px]")}
        />
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeId === item.id}
            isCollapsed={collapsed}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>


      {/* Bottom nav */}
      <div className="px-2 py-2 border-t border-emerald-500/10 space-y-1">
        {BOTTOM_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeId === item.id}
            isCollapsed={collapsed}
            onClick={() => onNavigate(item.id)}
          />
        ))}

        {/* Sun-cycle theme toggle (Auto · Light · Dark) */}
        <ThemeToggle collapsed={collapsed} />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
            "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]",
            "transition-all duration-200",
            collapsed && "justify-center"
          )}
        >
          <motion.span
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.span>
          {!collapsed && (
            <span className="text-sm font-medium">طي القائمة</span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
