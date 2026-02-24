"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

type Category = {
  id: string;
  name: string;
  type: string;
  color: string | null;
};

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function NewTransactionPage() {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [date, setDate] = useState(todayStr);
  const [categories, setCategories] = useState<Category[]>([]);
  const [walletId, setWalletId] = useState("");
  const [userId, setUserId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringRule, setRecurringRule] = useState("monthly");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Detect if selected date is in the future → will create scheduled payment
  const isFutureDate = useMemo(() => {
    if (!date) return false;
    return date > todayStr();
  }, [date]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: cats } = await supabase
        .from("categories")
        .select("id, name, type, color")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("name");
      if (cats) setCategories(cats);

      const { data: wallets } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      if (wallets?.[0]) setWalletId(wallets[0].id);
    }
    load();
  }, []);

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === "both"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      toast.error("Não autenticado");
      return;
    }
    if (!walletId) {
      toast.error("Carteira não encontrada");
      return;
    }
    setLoading(true);

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Valor inválido");
      setLoading(false);
      return;
    }

    if (isFutureDate) {
      // Future date → create as scheduled payment in Agenda
      const { error } = await supabase.from("scheduled_payments").insert({
        user_id: userId,
        wallet_id: walletId,
        title: description || "Sem descrição",
        amount_cents: amountCents,
        due_date: date,
        kind: "other" as const,
        type,
      });

      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        setLoading(false);
        return;
      }

      toast.success(type === "income" ? "Recebimento agendado!" : "Conta futura criada na Agenda!");
      router.push("/schedule");
      router.refresh();
    } else {
      // Today or past → create as normal transaction
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        wallet_id: walletId,
        type,
        amount_cents: amountCents,
        date,
        description,
        category_id: categoryId || null,
        payment_method: paymentMethod,
        is_recurring: isRecurring,
        recurring_rule: isRecurring ? recurringRule : null,
      });

      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        setLoading(false);
        return;
      }

      toast.success("Lançamento salvo!");
      router.push("/transactions");
      router.refresh();
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Novo lançamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === "income" ? "default" : "outline"}
                className={`flex-1 ${type === "income" ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
                onClick={() => setType("income")}
              >
                Entrada
              </Button>
              <Button
                type="button"
                variant={type === "expense" ? "default" : "outline"}
                className={`flex-1 ${type === "expense" ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
                onClick={() => setType("expense")}
              >
                Saída
              </Button>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="text-2xl font-bold h-14"
                inputMode="decimal"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                placeholder="Ex: Pix do cliente, Conta de luz..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Category - only for non-future (transactions) */}
            {!isFutureDate && (
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Payment Method - only for non-future (transactions) */}
            {!isFutureDate && (
              <div className="space-y-2">
                <Label>Método</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="card">Cartão</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Future date banner */}
            {isFutureDate && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <CalendarClock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Data futura detectada. Será criado como <strong>conta pendente na Agenda</strong>.
                  Quando você marcar como pago, vira um lançamento automaticamente.
                </p>
              </div>
            )}

            {/* Recurring - only for non-future (transactions) */}
            {!isFutureDate && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isRecurring}
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      isRecurring ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
                        isRecurring ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <Label className="cursor-pointer" onClick={() => setIsRecurring(!isRecurring)}>
                    Lançamento recorrente
                  </Label>
                </div>
                {isRecurring && (
                  <Select value={recurringRule} onValueChange={setRecurringRule}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Quinzenal</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Salvando..."
                : isFutureDate
                  ? "Salvar na Agenda"
                  : "Salvar lançamento"
              }
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
