"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "recharts";
const COLORS = ["#60A5FA", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#F472B6", "#38BDF8", "#FB923C"];
export default function ReportsPage() {
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [topExpenses, setTopExpenses] = useState<{ description: string; amount: number }[]>([]);
  const supabase = createClient();
  useEffect(() => {
    async function load() {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      // Category breakdown
      const { data: expenses } = await supabase
        .from("transactions")
        .select("amount_cents, categories(name, color)")
        .eq("type", "expense")
        .gte("date", startOfMonth)
        .lte("date", endOfMonth);
      if (expenses) {
        const map = new Map<string, { total: number; color: string }>();
        expenses.forEach((t) => {
          const catName = (t.categories as any)?.name ?? "Sem categoria";
          const catColor = (t.categories as any)?.color ?? "#94A3B8";
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
      }
      // Top expenses
      const { data: top } = await supabase
        .from("transactions")
        .select("description, amount_cents")
        .eq("type", "expense")
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
      }
    }
    load();
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatorios</h1>
        <p className="text-muted-foreground text-sm capitalize">
          {formatMonthYear(new Date())}
        </p>
      </div>
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
