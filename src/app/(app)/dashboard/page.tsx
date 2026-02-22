import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  CalendarClock,
} from "lucide-react";
import Link from "next/link";

type CategoryJoin = { name: string; color: string | null; icon: string | null } | null;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  // Fetch transactions for current month
  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, amount_cents")
    .eq("user_id", user.id)
    .gte("date", startOfMonth)
    .lte("date", endOfMonth);

  const income = (transactions ?? [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount_cents), 0);
  const expense = (transactions ?? [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount_cents), 0);
  const balance = income - expense;

  // Fetch pending scheduled payments
  const { data: pendingPayments } = await supabase
    .from("scheduled_payments")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gte("due_date", startOfMonth)
    .lte("due_date", endOfMonth);

  const pendingTotal = (pendingPayments ?? []).reduce(
    (sum, p) => sum + Number(p.amount_cents),
    0
  );
  const projected = balance - pendingTotal;

  // Upcoming payments (next 30 days)
  const today = now.toISOString().split("T")[0];
  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];
  const { data: upcoming } = await supabase
    .from("scheduled_payments")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gte("due_date", today)
    .lte("due_date", in30)
    .order("due_date", { ascending: true })
    .limit(5);

  // Recent transactions
  const { data: recent } = await supabase
    .from("transactions")
    .select("*, categories(name, color, icon)")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(5);

  const cards = [
    { title: "Entradas", value: income, icon: TrendingUp, color: "text-green-500" },
    { title: "Saidas", value: expense, icon: TrendingDown, color: "text-red-500" },
    { title: "Saldo do Mes", value: balance, icon: Wallet, color: balance >= 0 ? "text-green-500" : "text-red-500" },
    { title: "Saldo Previsto", value: projected, icon: Target, color: projected >= 0 ? "text-blue-500" : "text-red-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold capitalize">{formatMonthYear(now)}</h1>
        <p className="text-muted-foreground text-sm">Resumo financeiro do mes</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground">{card.title}</span>
              </div>
              <p className={`text-lg font-bold ${card.color}`}>
                {formatCurrency(card.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Proximos pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!upcoming || upcoming.length === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento pendente</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-red-500">
                      {formatCurrency(Number(p.amount_cents))}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/schedule"
              className="block mt-3 text-xs text-primary hover:underline"
            >
              Ver todos
            </Link>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Ultimos lancamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!recent || recent.length === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhum lancamento ainda</p>
            ) : (
              <div className="space-y-3">
                {recent.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.description || "Sem descricao"}</p>
                      <p className="text-xs text-muted-foreground">
                        {(t.categories as CategoryJoin)?.name ?? "Sem categoria"} - {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${t.type === "income" ? "text-green-500" : "text-red-500"}`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount_cents))}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/transactions"
              className="block mt-3 text-xs text-primary hover:underline"
            >
              Ver todos
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}