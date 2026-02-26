import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import webpush from "web-push";
import { NextResponse } from "next/server";

webpush.setVapidDetails(
  "mailto:contato@financego.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

  // Fetch all relevant scheduled payments
  const { data: payments } = await supabase
    .from("scheduled_payments")
    .select("user_id, title, amount_cents, due_date, status, type")
    .in("status", ["pending", "overdue"]);

  if (!payments || payments.length === 0) {
    return NextResponse.json({ sent: 0, message: "No pending payments" });
  }

  // Group notifications by user
  const userNotifications = new Map<string, { title: string; body: string; tag: string }[]>();

  for (const p of payments) {
    const notifications = userNotifications.get(p.user_id) ?? [];
    const valor = formatBRL(Number(p.amount_cents));
    const isIncome = p.type === "income";

    if (p.status === "overdue") {
      const dueDate = new Date(p.due_date + "T12:00:00");
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
      notifications.push({
        title: isIncome ? "Recebimento atrasado" : "Conta atrasada",
        body: `${p.title} - ${valor} (${diffDays}d atrasado)`,
        tag: `overdue-${p.due_date}`,
      });
    } else if (p.due_date === today) {
      notifications.push({
        title: isIncome ? "Recebimento previsto hoje" : "Conta vence hoje",
        body: `${p.title} - ${valor}`,
        tag: `today-${p.due_date}`,
      });
    } else if (p.due_date === tomorrowStr) {
      notifications.push({
        title: isIncome ? "Recebimento previsto amanha" : "Conta vence amanha",
        body: `${p.title} - ${valor}`,
        tag: `tomorrow-${p.due_date}`,
      });
    }

    if (notifications.length > 0) {
      userNotifications.set(p.user_id, notifications);
    }
  }

  let totalSent = 0;
  let totalFailed = 0;

  // For each user with notifications, get their push subscriptions and send
  for (const [userId, notifications] of userNotifications) {
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subscriptions || subscriptions.length === 0) continue;

    // Send max 3 notifications per user to avoid spam
    const toSend = notifications.slice(0, 3);

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      for (const notif of toSend) {
        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({
              title: notif.title,
              body: notif.body,
              tag: notif.tag,
              url: "/schedule",
            })
          );
          totalSent++;
        } catch (err: unknown) {
          totalFailed++;
          // If subscription is expired (410 Gone), remove it
          if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
        }
      }
    }
  }

  return NextResponse.json({
    sent: totalSent,
    failed: totalFailed,
    usersNotified: userNotifications.size,
  });
}
