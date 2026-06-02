"use client";

import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  className?: string;
  activeView?: string;
  onNavigate?: (id: string) => void;
}

export function WorkspaceLayout({
  children,
  className,
  activeView = "dashboard",
  onNavigate = () => {},
}: WorkspaceLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-forest-mesh">
      {/*
        RTL layout — Sidebar on the RIGHT (Arabic nav position).
        Single sidebar; AgentStatusBar removed to maximise content width.
      */}
      <Sidebar activeId={activeView} onNavigate={onNavigate} />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className={cn(
          "flex-1 flex flex-col min-w-0",
          className
        )}
      >
        {/* Hairline accent */}
        <div className="h-[1px] w-full bg-gradient-to-l from-transparent via-emerald-500/25 to-transparent flex-shrink-0" />

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </motion.main>
    </div>
  );
}
