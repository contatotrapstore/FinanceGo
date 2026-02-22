"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
const COLORS = ["#60A5FA", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#F472B6", "#38BDF8", "#FB923C"];

type CategoryJoin = { name: string; color: string | null } | null;

export default function ReportsPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [topExpenses, setTopExpenses] = useState<{ description: string; amount: number }[]>([]);
  const [dailyBalance, setDailyBalance] = useState<{ day: string; saldo: number }[]>([]);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const startOfMonth = new Date(year, month, 1).toISOString().split("T")[0];
    const endOfMonth = new Date(year, month + 1, 0).toISOString().split("T")[0];
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Category breakdown
    const { data: expenses } = await supabase
      .from("transactions")
      .select("amount_cents, categories(name, color)")
      .eq("type", "expense")
      .eq("user_id", user.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth);

    if (expenses) {
      const map = new Map<string, { total: number; color: string }>();
      expenses.forEach((t) => {
        const catName = (t.categories as CategoryJoin)?.name ?? "Sem categoria";
        const catColor = (t.categories as CategoryJoin)?.color ?? "#94A3B8";
        const existing = map.get(catName) || { total: 0, color: catColor };
        existing.total += Number(t.amount_cents);
        map.set(catName, existing);
      });
      const sorted = Array.from(map.entries())
        .map(([name, { total, color }], i) => ({
          name,
          value: total,
          color: color || COLORS[i % COLORS.length],
        }))
        .sort((a, b) => b.value - a.value);
      setCategoryData(sorted);
    } else {
      setCategoryData([]);
    }

    // Top expenses
    const { data: top } = await supabase
      .from("transactions")
      .select("description, amount_cents")
      .eq("type", "expense")
      .eq("user_id", user.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("amount_cents", { ascending: false })
      .limit(10);

    if (top) {
      setTopExpenses(
        top.map((t) => ({
          description: t.description || "Sem descricao",
          amount: Number(t.amount_cents),
        }))
      );
    } else {
      setTopExpenses([]);
    }

    // Daily balance for line chart
    const { data: allTx } = await supabase
      .from("transactions")
      .select("type, amount_cents, date")
      .eq("user_id", user.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date", { ascending: true });

    if (allTx) {
      const dayMap = new Map<number, number>();
      allTx.forEach((t) => {
        const day = new Date(t.date + "T12:00:00").getDate();
        const val = Number(t.amount_cents);
        const signed = t.type === "income" ? val : -val;
        dayMap.set(day, (dayMap.get(day) ?? 0) + signed);
      });

      let cumulative = 0;
      const daily: { day: string; saldo: number }[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        cumulative += dayMap.get(d) ?? 0;
        daily.push({ day: String(d), saldo: cumulative });
      }
      setDailyBalance(daily);
    } else {
      setDailyBalance([]);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function prevMonth() {
    setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Relatorios</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-[140px] text-center">
            {formatMonthYear(selectedDate)}
          </span>
          <Button size="sm" variant="outline" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Daily Balance Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saldo diario acumulado</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyBalance.length === 0 || dailyBalance.every((d) => d.saldo === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sem dados para exibir
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyBalance} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#60A5FA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    stroke="#60A5FA"
                    strokeWidth={2}
                    fill="url(#colorSaldo)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem dados para exibir
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {categoryData.length > 0 && (
              <div className="space-y-2 mt-4">
                {categoryData.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(c.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Top Expenses Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top despesas</CardTitle>
          </CardHeader>
          <CardContent>
            {topExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem dados para exibir
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topExpenses} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="description" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="amount" fill="#60A5FA" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
