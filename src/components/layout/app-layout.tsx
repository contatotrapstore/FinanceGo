"use client";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { ThemeToggle } from "./theme-toggle";
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex items-center justify-end h-14 px-4 border-b border-border bg-background/80 backdrop-blur-sm">
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