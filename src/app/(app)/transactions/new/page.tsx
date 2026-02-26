"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { createClient as createUntyped } from "@supabase/supabase-js";
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
import { CalendarClock, CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

type Category = {
  id: string;
  name: string;
  type: string;
  color: string | null;
};

type CCard = {
  id: string;
  name: string;
  last_four: string | null;
  color: string | null;
  status: string;
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
  const [cards, setCards] = useState<CCard[]>([]);
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const db = useMemo(() => createUntyped(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ), []);

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

      // Load credit cards
      const { data: userCards } = await db
        .from("credit_cards")
        .select("id, name, last_four, color, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("name");
      if (userCards) setCards(userCards as CCard[]);
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

    const selectedCardId = paymentMethod === "card" && cardId ? cardId : null;
    const numInstallments = selectedCardId && type === "expense" ? installments : 1;

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
    } else if (numInstallments > 1) {
      // Card purchase with installments
      const installmentAmountCents = Math.round(amountCents / numInstallments);
      const desc = description || "Sem descrição";

      // 1. Create installment record
      const { data: inst, error: instErr } = await db
        .from("installments")
        .insert({
          user_id: userId,
          card_id: selectedCardId,
          description: desc,
          total_amount_cents: amountCents,
          installment_amount_cents: installmentAmountCents,
          total_installments: numInstallments,
          paid_installments: 1,
          start_date: date,
          status: "active",
        })
        .select("id")
        .single();

      if (instErr || !inst) {
        toast.error("Erro ao criar parcelamento: " + (instErr?.message || ""));
        setLoading(false);
        return;
      }

      // 2. Create first transaction (current month)
      const { error: txErr } = await db
        .from("transactions")
        .insert({
          user_id: userId,
          wallet_id: walletId,
          type: "expense",
          amount_cents: installmentAmountCents,
          date,
          description: `${desc} (1/${numInstallments})`,
          category_id: categoryId || null,
          payment_method: "card",
          card_id: selectedCardId,
          installment_id: inst.id,
          is_recurring: false,
        });

      if (txErr) {
        toast.error("Erro ao salvar lançamento: " + txErr.message);
        setLoading(false);
        return;
      }

      // 3. Create N-1 scheduled payments for future months
      const scheduledRows = [];
      const startDate = new Date(date + "T12:00:00");
      for (let i = 2; i <= numInstallments; i++) {
        const futureDate = new Date(startDate);
        futureDate.setMonth(futureDate.getMonth() + (i - 1));
        const dueDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
        scheduledRows.push({
          user_id: userId,
          wallet_id: walletId,
          title: `${desc} (${i}/${numInstallments})`,
          amount_cents: installmentAmountCents,
          due_date: dueDateStr,
          kind: "credit_card",
          type: "expense",
          card_id: selectedCardId,
          installment_id: inst.id,
        });
      }

      if (scheduledRows.length > 0) {
        const { error: schErr } = await db
          .from("scheduled_payments")
          .insert(scheduledRows);
        if (schErr) {
          toast.error("Erro ao criar parcelas futuras: " + schErr.message);
          setLoading(false);
          return;
        }
      }

      toast.success(`Compra parcelada em ${numInstallments}x salva!`);
      router.push("/transactions");
      router.refresh();
    } else {
      // Normal transaction (single or 1x card)
      const insertData: Record<string, unknown> = {
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
      };
      if (selectedCardId) {
        insertData.card_id = selectedCardId;
      }

      const { error } = await db.from("transactions").insert(insertData);

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

            {/* Card Selector - when payment method is card */}
            {!isFutureDate && paymentMethod === "card" && cards.length > 0 && (
              <div className="space-y-2">
                <Label>Cartão</Label>
                <Select value={cardId} onValueChange={setCardId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cartão..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: c.color || "#7C3AED" }}
                          />
                          {c.name}
                          {c.last_four && <span className="text-muted-foreground">•••• {c.last_four}</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Installments - when card is selected and type is expense */}
            {!isFutureDate && paymentMethod === "card" && cardId && type === "expense" && (
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x {amount ? `de R$ ${(parseFloat(amount) / n).toFixed(2)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {installments > 1 && amount && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                    <CreditCard className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-violet-700 dark:text-violet-300">
                      Será criado <strong>1 lançamento</strong> para este mês e{" "}
                      <strong>{installments - 1} agendamentos</strong> futuros de{" "}
                      R$ {(parseFloat(amount) / installments).toFixed(2)}/mês.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* No cards warning */}
            {!isFutureDate && paymentMethod === "card" && cards.length === 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <CreditCard className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Nenhum cartão cadastrado.{" "}
                  <a href="/settings" className="underline font-medium">Cadastre um cartão</a> em Configurações.
                </p>
              </div>
            )}

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <div className="flex gap-1.5 mb-1.5">
                {[
                  { label: "Hoje", offset: 0 },
                  { label: "Ontem", offset: -1 },
                  { label: "Anteontem", offset: -2 },
                ].map((shortcut) => {
                  const d = new Date();
                  d.setDate(d.getDate() + shortcut.offset);
                  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  return (
                    <button
                      key={shortcut.label}
                      type="button"
                      onClick={() => setDate(val)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        date === val
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {shortcut.label}
                    </button>
                  );
                })}
              </div>
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
