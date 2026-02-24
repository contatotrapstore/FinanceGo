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
  AlertTriangle,
  DollarSign,
  Plus,
} from "lucide-react";
import Link from "next/link";

type CategoryJoin = { name: string; color: string | null; icon: string | null } | null;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yr = now.getFullYear();
  const mo = now.getMonth();
  const startOfMonth = `${yr}-${pad(mo + 1)}-01`;
  const lastDay = new Date(yr, mo + 1, 0).getDate();
  const endOfMonth = `${yr}-${pad(mo + 1)}-${pad(lastDay)}`;
  const today = `${yr}-${pad(mo + 1)}-${pad(now.getDate())}`;

  // Fetch ALL transactions for cumulative balance ("Saldo Atual")
  const { data: allTransactions } = await supabase
    .from("transactions")
    .select("type, amount_cents")
    .eq("user_id", user.id);

  const totalIncome = (allTransactions ?? [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount_cents), 0);
  const totalExpense = (allTransactions ?? [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount_cents), 0);
  const saldoAtual = totalIncome - totalExpense;

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

  // Fetch ALL pending/overdue scheduled payments (not just current month)
  const { data: allPendingPayments } = await supabase
    .from("scheduled_payments")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["pending", "overdue"]);

  const pendingExpenses = (allPendingPayments ?? [])
    .filter((p) => p.type !== "income")
    .reduce((sum, p) => sum + Number(p.amount_cents), 0);
  const pendingIncome = (allPendingPayments ?? [])
    .filter((p) => p.type === "income")
    .reduce((sum, p) => sum + Number(p.amount_cents), 0);
  const allPendingTotal = pendingExpenses;
  const projected = saldoAtual - pendingExpenses + pendingIncome;

  // Upcoming payments (next 30 days)
  const d30 = new Date(now.getTime() + 30 * 86400000);
  const in30 = `${d30.getFullYear()}-${pad(d30.getMonth() + 1)}-${pad(d30.getDate())}`;
  const { data: upcoming } = await supabase
    .from("scheduled_payments")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gte("due_date", today)
    .lte("due_date", in30)
    .order("due_date", { ascending: true })
    .limit(5);

  // Urgent payments (next 3 days) — split by type
  const d3 = new Date(now.getTime() + 3 * 86400000);
  const in3 = `${d3.getFullYear()}-${pad(d3.getMonth() + 1)}-${pad(d3.getDate())}`;
  const urgentAll = (upcoming ?? []).filter((p) => p.due_date <= in3);
  const urgentBills = urgentAll.filter((p) => p.type !== "income");
  const urgentReceivables = urgentAll.filter((p) => p.type === "income");

  // Recent transactions
  const { data: recent } = await supabase
    .from("transactions")
    .select("*, categories(name, color, icon)")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(5);

  const cards = [
    { title: "Entradas", value: income, icon: TrendingUp, color: "text-green-500" },
    { title: "Saídas", value: expense, icon: TrendingDown, color: "text-red-500" },
    { title: "Saldo do Mês", value: balance, icon: Wallet, color: balance >= 0 ? "text-green-500" : "text-red-500" },
    { title: "Saldo Previsto", value: projected, icon: Target, color: projected >= 0 ? "text-blue-500" : "text-red-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold capitalize">{formatMonthYear(now)}</h1>
        <p className="text-muted-foreground text-sm">Resumo financeiro do mês</p>
      </div>

      {/* Saldo Atual - Destaque */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Saldo Atual</span>
              </div>
              <p className={`text-2xl font-bold ${saldoAtual >= 0 ? "text-primary" : "text-red-500"}`}>
                {formatCurrency(saldoAtual)}
              </p>
            </div>
            {(pendingExpenses > 0 || pendingIncome > 0) && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Após pendências</p>
                <p className={`text-lg font-semibold ${projected >= 0 ? "text-primary" : "text-red-500"}`}>
                  {formatCurrency(projected)}
                </p>
              </div>
            )}
          </div>
          {/* Quick summary phrase */}
          <p className="text-xs text-muted-foreground mt-2">
            {expense > 0
              ? `Você gastou ${formatCurrency(expense)} este mês.`
              : "Nenhum gasto registrado este mês."
            }
            {pendingExpenses > 0 && ` Faltam ${formatCurrency(pendingExpenses)} em contas a pagar.`}
            {pendingIncome > 0 && ` ${formatCurrency(pendingIncome)} a receber.`}
          </p>
        </CardContent>
      </Card>

      {/* Quick action when no transactions yet */}
      {(!allTransactions || allTransactions.length === 0) && (
        <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-4 px-4">
            <div className="flex items-start gap-3">
              <Plus className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Comece registrando suas entradas!
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Registre seu salário ou receitas para ver o saldo. Contas futuras vão para a Agenda automaticamente.
                </p>
                <Link
                  href="/transactions/new"
                  className="inline-block mt-2 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-3 py-1.5 rounded-md hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
                >
                  + Registrar entrada
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Urgent Bills Alert (expenses only) */}
      {urgentBills.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {urgentBills.length === 1
                    ? "Conta vencendo em breve!"
                    : `${urgentBills.length} contas vencem nos próximos 3 dias!`
                  }
                </p>
                {urgentBills.map((p) => (
                  <p key={p.id} className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                    {p.title}: {formatCurrency(Number(p.amount_cents))} — vence {new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Receivables Alert (income only) */}
      {urgentReceivables.length > 0 && (
        <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {urgentReceivables.length === 1
                    ? "Recebimento previsto em breve!"
                    : `${urgentReceivables.length} recebimentos previstos nos próximos 3 dias!`
                  }
                </p>
                {urgentReceivables.map((p) => (
                  <p key={p.id} className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                    {p.title}: +{formatCurrency(Number(p.amount_cents))} — previsto {new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="pt-3 pb-2 px-3 lg:pt-4 lg:pb-3 lg:px-4">
              <div className="flex items-center gap-1.5 mb-0.5">
                <card.icon className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${card.color}`} />
                <span className="text-xs lg:text-sm text-muted-foreground">{card.title}</span>
              </div>
              <p className={`text-base lg:text-xl font-bold ${card.color}`}>
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
              Agenda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!upcoming || upcoming.length === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhuma pendência agendada</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        {" — "}
                        <span className={p.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {p.type === "income" ? "recebimento" : "conta"}
                        </span>
                      </p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${p.type === "income" ? "text-green-500" : "text-red-500"}`}>
                      {p.type === "income" ? "+" : "-"}{formatCurrency(Number(p.amount_cents))}
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
              Últimos lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!recent || recent.length === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhum lançamento ainda</p>
            ) : (
              <div className="space-y-3">
                {recent.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.description || "Sem descrição"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(t.categories as CategoryJoin)?.name ?? "Sem categoria"} - {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${t.type === "income" ? "text-green-500" : "text-red-500"}`}>
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
