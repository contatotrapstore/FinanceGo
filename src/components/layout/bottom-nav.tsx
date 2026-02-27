"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Plus,
  CalendarClock,
  ArrowLeftRight,
  MessageSquare,
  BarChart3,
  Settings,
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  CalendarPlus,
  Ellipsis,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const mainTabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Extrato", icon: ArrowLeftRight },
  { href: "/ai", label: "IA", icon: MessageSquare },
];

const quickActions = [
  {
    label: "Despesa",
    description: "Registrar gasto",
    icon: ArrowDownCircle,
    href: "/transactions/new?type=expense",
    color: "bg-red-500",
    ring: "ring-red-500/20",
  },
  {
    label: "Receita",
    description: "Registrar entrada",
    icon: ArrowUpCircle,
    href: "/transactions/new?type=income",
    color: "bg-emerald-500",
    ring: "ring-emerald-500/20",
  },
  {
    label: "Cartão",
    description: "Compra no cartão",
    icon: CreditCard,
    href: "/transactions/new?type=expense&method=card",
    color: "bg-violet-500",
    ring: "ring-violet-500/20",
  },
  {
    label: "Conta Futura",
    description: "Agendar pagamento",
    icon: CalendarPlus,
    href: "/transactions/new?type=expense&scheduled=true",
    color: "bg-blue-500",
    ring: "ring-blue-500/20",
  },
];

const moreItems = [
  {
    href: "/schedule",
    label: "Agenda",
    description: "Contas e cobranças futuras",
    icon: CalendarClock,
    color: "bg-blue-500",
  },
  {
    href: "/reports",
    label: "Relatórios",
    description: "Gráficos e análises",
    icon: BarChart3,
    color: "bg-amber-500",
  },
  {
    href: "/settings",
    label: "Configurações",
    description: "Cartões, categorias e perfil",
    icon: Settings,
    color: "bg-slate-500",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [fabOpen, setFabOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border px-1 pb-safe">
      <div className="flex items-center justify-around h-16">
        {/* Home tab */}
        {mainTabs.slice(0, 2).map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] transition-all rounded-xl min-w-[60px]",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center h-8 w-8 rounded-xl transition-all",
                isActive && "bg-primary/10 scale-110"
              )}>
                <item.icon className={cn("h-[20px] w-[20px]", isActive && "h-[22px] w-[22px]")} />
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* FAB - Plus button */}
        <Sheet open={fabOpen} onOpenChange={setFabOpen}>
          <SheetTrigger asChild>
            <button
              className="flex items-center justify-center -mt-6 h-[56px] w-[56px] rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-all"
            >
              <Plus className={cn("h-7 w-7 transition-transform duration-200", fabOpen && "rotate-45")} />
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl pb-safe"
            showCloseButton={false}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>
            <SheetHeader className="px-6 pt-2 pb-0">
              <SheetTitle className="text-left text-base">Novo lançamento</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-4 gap-3 px-6 py-5">
              {quickActions.map((action) => (
                <button
                  key={action.href}
                  onClick={() => {
                    setFabOpen(false);
                    router.push(action.href);
                  }}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className={cn(
                    "flex items-center justify-center h-14 w-14 rounded-2xl text-white transition-all group-active:scale-90",
                    action.color,
                    "ring-4",
                    action.ring
                  )}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-medium text-foreground leading-tight text-center">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* IA tab */}
        {(() => {
          const aiItem = mainTabs[2];
          const isActive = pathname.startsWith(aiItem.href);
          return (
            <Link
              href={aiItem.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] transition-all rounded-xl min-w-[60px]",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center h-8 w-8 rounded-xl transition-all",
                isActive && "bg-primary/10 scale-110"
              )}>
                <aiItem.icon className={cn("h-[20px] w-[20px]", isActive && "h-[22px] w-[22px]")} />
              </div>
              <span>{aiItem.label}</span>
            </Link>
          );
        })()}

        {/* More menu */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] transition-all rounded-xl min-w-[60px]",
                isMoreActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center h-8 w-8 rounded-xl transition-all",
                isMoreActive && "bg-primary/10 scale-110"
              )}>
                <Ellipsis className={cn("h-[20px] w-[20px]", isMoreActive && "h-[22px] w-[22px]")} />
              </div>
              <span>Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl pb-safe"
            showCloseButton={false}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>
            <SheetHeader className="px-6 pt-2 pb-0">
              <SheetTitle className="text-left text-base">Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4 py-4">
              {moreItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-2xl transition-all",
                      isActive
                        ? "bg-primary/10"
                        : "hover:bg-accent active:bg-accent"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center h-10 w-10 rounded-xl text-white shrink-0",
                      item.color
                    )}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className={cn(
                        "text-sm font-medium",
                        isActive ? "text-primary" : "text-foreground"
                      )}>
                        {item.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {item.description}
                      </span>
                    </div>
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
