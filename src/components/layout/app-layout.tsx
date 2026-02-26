"use client";
import Link from "next/link";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { ThemeToggle } from "./theme-toggle";
import { PaymentReminder } from "../notifications/payment-reminder";
import { Settings, Wallet } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PaymentReminder />
      <Sidebar />
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-background/80 backdrop-blur-sm">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold text-foreground">
              Finance<span className="text-primary">GO</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/settings"
              className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex sticky top-0 z-40 items-center justify-end h-14 px-4 border-b border-border bg-background/80 backdrop-blur-sm">
          <ThemeToggle />
        </header>

        <main className="px-4 py-6 pb-24 lg:pb-6 max-w-5xl mx-auto">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
