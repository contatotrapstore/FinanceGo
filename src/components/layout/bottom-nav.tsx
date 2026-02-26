"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Plus,
  CalendarClock,
  ArrowLeftRight,
  Menu,
  MessageSquare,
  BarChart3,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const mainItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Extrato", icon: ArrowLeftRight },
  { href: "/transactions/new", label: "Lançar", icon: Plus, isMain: true },
  { href: "/schedule", label: "Agenda", icon: CalendarClock },
];

const moreItems = [
  { href: "/ai", label: "IA Chat", icon: MessageSquare },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-2 pb-safe">
      <div className="flex items-center justify-around h-16">
        {mainItems.map((item) => {
          const isActive = pathname.startsWith(item.href) && !item.isMain;
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
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors rounded-lg",
                isActive
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "h-[22px] w-[22px]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* More menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors rounded-lg",
                isMoreActive
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-muted-foreground"
              )}
            >
              <Menu className={cn("h-5 w-5", isMoreActive && "h-[22px] w-[22px]")} />
              <span>Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetHeader>
              <SheetTitle className="text-left">Menu</SheetTitle>
            </SheetHeader>
            <div className="grid gap-1 mt-4 pb-4">
              {moreItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
