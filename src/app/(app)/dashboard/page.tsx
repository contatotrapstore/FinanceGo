import { createClient } from "@/lib/supabase/server";
import { createClient as createUntyped } from "@supabase/supabase-js";
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
  Activity,
  CreditCard,
  ShoppingBag,
  HeartPulse,
  Landmark,
} from "lucide-react";
import Link from "next/link";

type CategoryJoin = { name: string; color: string | null; icon: string | null } | null;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const db = createUntyped(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  // Set auth for RLS
  db.auth.setSession({
    access_token: (await supabase.auth.getSession()).data.session?.access_token ?? "",
    refresh_token: (await supabase.auth.getSession()).data.session?.refresh_token ?? "",
  });

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

  // Today's spending
  const { data: todayTx } = await supabase
    .from("transactions")
    .select("type, amount_cents")
    .eq("user_id", user.id)
    .eq("date", today)
    .eq("type", "expense");
  const todaySpending = (todayTx ?? []).reduce((sum, t) => sum + Number(t.amount_cents), 0);

  // Fetch PREVIOUS month transactions for comparison
  const prevMo = mo === 0 ? 11 : mo - 1;
  const prevYr = mo === 0 ? yr - 1 : yr;
  const prevStart = `${prevYr}-${pad(prevMo + 1)}-01`;
  const prevLastDay = new Date(prevYr, prevMo + 1, 0).getDate();
  const prevEnd = `${prevYr}-${pad(prevMo + 1)}-${pad(prevLastDay)}`;
  const prevMonthName = new Date(prevYr, prevMo).toLocaleDateString("pt-BR", { month: "short" });

  const { data: prevTransactions } = await supabase
    .from("transactions")
    .select("type, amount_cents")
    .eq("user_id", user.id)
    .gte("date", prevStart)
    .lte("date", prevEnd);

  const prevExpense = (prevTransactions ?? [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount_cents), 0);

  // Spending pace calculation
  const dayOfMonth = now.getDate();
  const pctMonthPassed = Math.round((dayOfMonth / lastDay) * 100);
  const pctBudgetUsed = prevExpense > 0 ? Math.round((expense / prevExpense) * 100) : 0;

  // Profile for greeting
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const userName = profile?.name?.split(" ")[0] || "";

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

  // ====== CREDIT CARDS ======
  const { data: creditCards } = await db
    .from("credit_cards")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("name");

  // For each card, compute current billing cycle usage
  type CardWithUsage = {
    id: string;
    name: string;
    last_four: string | null;
    color: string;
    credit_limit_cents: number;
    closing_day: number;
    payment_day: number;
    used_cents: number;
  };

  const cardsWithUsage: CardWithUsage[] = [];
  for (const card of (creditCards ?? [])) {
    // Billing cycle: closing_day of previous month → closing_day of current month
    const closingDay = card.closing_day || 1;
    let cycleStart: string;
    let cycleEnd: string;

    if (now.getDate() <= closingDay) {
      // We're before closing: cycle is from prev month's closing_day+1 to this month's closing_day
      const prevMonth = mo === 0 ? 11 : mo - 1;
      const prevYear = mo === 0 ? yr - 1 : yr;
      cycleStart = `${prevYear}-${pad(prevMonth + 1)}-${pad(Math.min(closingDay + 1, 28))}`;
      cycleEnd = `${yr}-${pad(mo + 1)}-${pad(Math.min(closingDay, lastDay))}`;
    } else {
      // We're after closing: cycle is from this month's closing_day+1 to next month's closing_day
      const nextMonth = mo === 11 ? 0 : mo + 1;
      const nextYear = mo === 11 ? yr + 1 : yr;
      const nextLastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
      cycleStart = `${yr}-${pad(mo + 1)}-${pad(Math.min(closingDay + 1, lastDay))}`;
      cycleEnd = `${nextYear}-${pad(nextMonth + 1)}-${pad(Math.min(closingDay, nextLastDay))}`;
    }

    // Fetch transactions for this card in current billing cycle
    const { data: cardTx } = await db
      .from("transactions")
      .select("amount_cents")
      .eq("user_id", user.id)
      .eq("card_id", card.id)
      .eq("type", "expense")
      .gte("date", cycleStart)
      .lte("date", cycleEnd);

    // Also include scheduled payments for this card in the billing cycle
    const { data: cardSch } = await db
      .from("scheduled_payments")
      .select("amount_cents")
      .eq("user_id", user.id)
      .eq("card_id", card.id)
      .in("status", ["pending", "overdue"])
      .gte("due_date", cycleStart)
      .lte("due_date", cycleEnd);

    const usedTx = (cardTx ?? []).reduce((sum: number, t: { amount_cents: number }) => sum + Number(t.amount_cents), 0);
    const usedSch = (cardSch ?? []).reduce((sum: number, t: { amount_cents: number }) => sum + Number(t.amount_cents), 0);

    cardsWithUsage.push({
      id: card.id,
      name: card.name,
      last_four: card.last_four,
      color: card.color || "#7C3AED",
      credit_limit_cents: Number(card.credit_limit_cents),
      closing_day: card.closing_day,
      payment_day: card.payment_day,
      used_cents: usedTx + usedSch,
    });
  }

  const totalCardUsed = cardsWithUsage.reduce((sum, c) => sum + c.used_cents, 0);
  const totalCardLimit = cardsWithUsage.reduce((sum, c) => sum + c.credit_limit_cents, 0);

  // ====== INSTALLMENTS ======
  const { data: activeInstallments } = await db
    .from("installments")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const installmentCount = (activeInstallments ?? []).length;
  const installmentMonthly = (activeInstallments ?? []).reduce(
    (sum: number, i: { installment_amount_cents: number }) => sum + Number(i.installment_amount_cents), 0
  );

  // ====== LOANS ======
  const { data: activeLoans } = await db
    .from("loans")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("name");

  const loanCount = (activeLoans ?? []).length;
  const loanMonthly = (activeLoans ?? []).reduce(
    (sum: number, l: { monthly_payment_cents: number }) => sum + Number(l.monthly_payment_cents), 0
  );
  const loanTotalRemaining = (activeLoans ?? []).reduce(
    (sum: number, l: { monthly_payment_cents: number; total_installments: number; paid_installments: number }) =>
      sum + Number(l.monthly_payment_cents) * (l.total_installments - l.paid_installments), 0
  );

  // ====== FINANCIAL HEALTH ======
  const maxCardPct = cardsWithUsage.length > 0
    ? Math.max(...cardsWithUsage.map((c) => c.credit_limit_cents > 0 ? (c.used_cents / c.credit_limit_cents) * 100 : 0))
    : 0;
  const hasOverdue = (allPendingPayments ?? []).some((p) => p.status === "overdue");

  let healthStatus: "saudavel" | "atencao" | "alerta";
  let healthLabel: string;
  let healthColor: string;
  let healthBg: string;

  if (saldoAtual < 0 || maxCardPct > 80) {
    healthStatus = "alerta";
    healthLabel = "Alerta";
    healthColor = "text-red-600 dark:text-red-400";
    healthBg = "bg-red-100 dark:bg-red-950/40";
  } else if (maxCardPct > 60 || hasOverdue || projected < 0) {
    healthStatus = "atencao";
    healthLabel = "Atenção";
    healthColor = "text-amber-600 dark:text-amber-400";
    healthBg = "bg-amber-100 dark:bg-amber-950/40";
  } else {
    healthStatus = "saudavel";
    healthLabel = "Saudável";
    healthColor = "text-green-600 dark:text-green-400";
    healthBg = "bg-green-100 dark:bg-green-950/40";
  }

  const summaryCards = [
    { title: "Entradas", value: income, icon: TrendingUp, color: "text-green-500" },
    { title: "Saídas", value: expense, icon: TrendingDown, color: "text-red-500" },
    { title: "Saldo do Mês", value: balance, icon: Wallet, color: balance >= 0 ? "text-green-500" : "text-red-500" },
    { title: "Saldo Previsto", value: projected, icon: Target, color: projected >= 0 ? "text-blue-500" : "text-red-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header with greeting + health badge + today's spending */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{greeting}{userName ? `, ${userName}` : ""}!</h1>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${healthColor} ${healthBg}`}>
              <HeartPulse className="h-3 w-3" />
              {healthLabel}
            </span>
          </div>
          <p className="text-muted-foreground text-sm capitalize">{formatMonthYear(now)}</p>
        </div>
        {todaySpending > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Hoje</p>
            <p className="text-sm font-bold text-red-500">-{formatCurrency(todaySpending)}</p>
          </div>
        )}
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
          {/* Quick summary phrase with comparison */}
          <p className="text-xs text-muted-foreground mt-2">
            {expense > 0
              ? `Você gastou ${formatCurrency(expense)} este mês`
              : "Nenhum gasto registrado este mês"
            }
            {expense > 0 && prevExpense > 0 && (() => {
              const pctChange = Math.round(((expense - prevExpense) / prevExpense) * 100);
              if (pctChange > 0) return <span className="text-red-500 font-medium">{` · ↑${pctChange}% vs ${prevMonthName}`}</span>;
              if (pctChange < 0) return <span className="text-green-500 font-medium">{` · ↓${Math.abs(pctChange)}% vs ${prevMonthName}`}</span>;
              return <span className="text-muted-foreground">{` · = vs ${prevMonthName}`}</span>;
            })()}
            {expense > 0 ? "." : "."}
            {pendingExpenses > 0 && ` Faltam ${formatCurrency(pendingExpenses)} em contas a pagar.`}
            {pendingIncome > 0 && ` ${formatCurrency(pendingIncome)} a receber.`}
            {totalCardUsed > 0 && ` Faturas: ${formatCurrency(totalCardUsed)}.`}
            {installmentMonthly > 0 && ` Parcelas: ${formatCurrency(installmentMonthly)}/mês.`}
            {loanMonthly > 0 && ` Empréstimos: ${formatCurrency(loanMonthly)}/mês.`}
          </p>
        </CardContent>
      </Card>

      {/* Credit Cards Section */}
      {cardsWithUsage.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Cartões de Crédito</h2>
            {totalCardLimit > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {formatCurrency(totalCardLimit - totalCardUsed)} disponível
              </span>
            )}
          </div>
          <div className="grid gap-2">
            {cardsWithUsage.map((card) => {
              const pct = card.credit_limit_cents > 0
                ? Math.round((card.used_cents / card.credit_limit_cents) * 100)
                : 0;
              const available = card.credit_limit_cents - card.used_cents;
              const barColor = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-green-500";

              return (
                <Card key={card.id}>
                  <CardContent className="pt-3 pb-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: card.color }}
                        />
                        <span className="text-sm font-medium">{card.name}</span>
                        {card.last_four && (
                          <span className="text-xs text-muted-foreground">•••• {card.last_four}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Fecha dia {card.closing_day} · Vence dia {card.payment_day}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 mb-1.5">
                      <div
                        className={`h-2 rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {formatCurrency(card.used_cents)} de {formatCurrency(card.credit_limit_cents)}
                      </span>
                      <span className={available >= 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-red-500 font-medium"}>
                        {available >= 0 ? `${formatCurrency(available)} disponível` : `${formatCurrency(Math.abs(available))} excedido`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Installments */}
      {installmentCount > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium">Parcelas Ativas</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {installmentCount} {installmentCount === 1 ? "compra" : "compras"} · {formatCurrency(installmentMonthly)}/mês
              </span>
            </div>
            <div className="space-y-1.5">
              {(activeInstallments ?? []).slice(0, 5).map((inst: {
                id: string;
                description: string;
                paid_installments: number;
                total_installments: number;
                installment_amount_cents: number;
              }) => (
                <div key={inst.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1 text-foreground">
                    {inst.description}
                    <span className="text-muted-foreground ml-1">
                      {inst.paid_installments}/{inst.total_installments}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground font-medium">
                    {formatCurrency(Number(inst.installment_amount_cents))}/mês
                  </span>
                </div>
              ))}
              {installmentCount > 5 && (
                <p className="text-xs text-muted-foreground">+{installmentCount - 5} mais...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Loans */}
      {loanCount > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Empréstimos</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {loanCount} {loanCount === 1 ? "empréstimo" : "empréstimos"} · {formatCurrency(loanMonthly)}/mês
              </span>
            </div>
            <div className="space-y-2">
              {(activeLoans ?? []).slice(0, 5).map((loan: {
                id: string;
                name: string;
                lender: string | null;
                monthly_payment_cents: number;
                total_installments: number;
                paid_installments: number;
                interest_rate_pct: number;
              }) => {
                const pct = loan.total_installments > 0
                  ? Math.round((loan.paid_installments / loan.total_installments) * 100)
                  : 0;
                const remaining = loan.total_installments - loan.paid_installments;
                return (
                  <div key={loan.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate flex-1 text-foreground">
                        {loan.name}
                        <span className="text-muted-foreground ml-1">
                          {loan.paid_installments}/{loan.total_installments}
                        </span>
                        {loan.interest_rate_pct > 0 && (
                          <span className="text-amber-500 ml-1">{loan.interest_rate_pct}%</span>
                        )}
                      </span>
                      <span className="shrink-0 text-muted-foreground font-medium">
                        {formatCurrency(Number(loan.monthly_payment_cents))}/mês
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1">
                      <div className="h-1 rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Total restante: {formatCurrency(loanTotalRemaining)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Spending Pace Card */}
      {prevExpense > 0 && expense > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Ritmo de gastos</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 mb-2">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  pctBudgetUsed > pctMonthPassed ? "bg-red-500" : "bg-green-500"
                }`}
                style={{ width: `${Math.min(pctBudgetUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{pctBudgetUsed}% do gasto de {prevMonthName}</span>
              <span>Dia {dayOfMonth}/{lastDay} ({pctMonthPassed}%)</span>
            </div>
            <p className="text-xs mt-1.5">
              {pctBudgetUsed > pctMonthPassed + 15
                ? <span className="text-red-500 font-medium">Ritmo acelerado — cuidado com os gastos</span>
                : pctBudgetUsed > 100
                  ? <span className="text-red-500 font-medium">Já ultrapassou o total do mês anterior</span>
                  : <span className="text-green-600 dark:text-green-400 font-medium">No ritmo — gastos dentro do esperado</span>
              }
            </p>
          </CardContent>
        </Card>
      )}

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
        {summaryCards.map((card) => (
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
