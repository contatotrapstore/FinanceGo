"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plus,
  CalendarClock,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/schedule", label: "Agenda", icon: CalendarClock },
  { href: "/transactions/new", label: "Lancar", icon: Plus, isMain: true },
  { href: "/reports", label: "Relatorios", icon: BarChart3 },
  { href: "/ai", label: "IA", icon: MessageSquare },
];
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-2 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          if (item.isMain) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-center -mt-5 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg"
              >
                <item.icon className="h-7 w-7" />
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}