"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PaymentReminder() {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    async function checkUpcoming() {
      // Only run if Notification API is available
      if (!("Notification" in window)) return;

      // Request permission if not yet decided
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission !== "granted") return;

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const today = localDateStr(now);
      const in3Days = localDateStr(new Date(now.getTime() + 3 * 86400000));

      // Check for expense payments due in the next 3 days (ignore income)
      const { data: upcoming } = await supabase
        .from("scheduled_payments")
        .select("title, amount_cents, due_date, type")
        .eq("user_id", user.id)
        .in("status", ["pending", "overdue"])
        .gte("due_date", today)
        .lte("due_date", in3Days)
        .neq("type", "income")
        .order("due_date", { ascending: true });

      if (!upcoming || upcoming.length === 0) return;

      // Check overdue expense payments too
      const { data: overdue } = await supabase
        .from("scheduled_payments")
        .select("title, amount_cents, due_date, type")
        .eq("user_id", user.id)
        .eq("status", "overdue")
        .lt("due_date", today)
        .neq("type", "income")
        .order("due_date", { ascending: true })
        .limit(5);

      // Avoid spamming: only notify once per session (ref prevents re-run)
      // Show a single grouped notification
      const total = upcoming.length + (overdue?.length ?? 0);
      const overdueCount = overdue?.length ?? 0;

      let body = "";
      if (overdueCount > 0) {
        body += `${overdueCount} conta${overdueCount > 1 ? "s" : ""} atrasada${overdueCount > 1 ? "s" : ""}! `;
      }
      if (upcoming.length > 0) {
        body += `${upcoming.length} conta${upcoming.length > 1 ? "s" : ""} vence${upcoming.length > 1 ? "m" : ""} nos próximos 3 dias.`;
      }

      const totalCents = [...upcoming, ...(overdue ?? [])].reduce(
        (sum, p) => sum + Number(p.amount_cents), 0
      );
      body += ` Total: R$ ${(totalCents / 100).toFixed(2).replace(".", ",")}`;

      // Show notification
      new Notification("FinanceGO - Contas pendentes", {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "payment-reminder", // Prevents duplicate notifications
      });
    }

    // Small delay to not block initial render
    const timer = setTimeout(checkUpcoming, 2000);
    return () => clearTimeout(timer);
  }, []);

  return null; // This component doesn't render anything
}
