"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Check, CalendarClock, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type ScheduledKind = Database["public"]["Enums"]["scheduled_kind"];

type ScheduledPayment = {
  id: string;
  title: string;
  amount_cents: number;
  due_date: string;
  kind: string;
  status: string;
  type: "income" | "expense";
};

const kindLabels: Record<string, string> = {
  credit_card: "Cartão",
  loan: "Empréstimo",
  fixed_bill: "Conta Fixa",
  subscription: "Assinatura",
  variable_bill: "Conta Variável",
  other: "Outro",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  canceled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function SchedulePage() {
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [kind, setKind] = useState<ScheduledKind>("other");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [walletId, setWalletId] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editKind, setEditKind] = useState<ScheduledKind>("other");
  const [editType, setEditType] = useState<"income" | "expense">("expense");
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const supabase = createClient();

  const loadPayments = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("scheduled_payments")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true });
    if (data) {
      // Auto-detect overdue: mark pending payments with past due_date
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const overdueIds = data
        .filter((p) => p.status === "pending" && p.due_date < today)
        .map((p) => p.id);
      if (overdueIds.length > 0) {
        await supabase
          .from("scheduled_payments")
          .update({ status: "overdue" })
          .in("id", overdueIds);
        const { data: refreshed } = await supabase
          .from("scheduled_payments")
          .select("*")
          .eq("user_id", user.id)
          .order("due_date", { ascending: true });
        if (refreshed) setPayments(refreshed as ScheduledPayment[]);
      } else {
        setPayments(data as ScheduledPayment[]);
      }
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: wallets } = await supabase.from("wallets").select("id").eq("user_id", user.id).limit(1);
      if (wallets?.[0]) setWalletId(wallets[0].id);
      loadPayments();
    }
    init();
  }, [loadPayments]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Valor inválido");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Não autenticado");
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("scheduled_payments").insert({
      user_id: user.id,
      wallet_id: walletId,
      title,
      amount_cents: amountCents,
      due_date: dueDate,
      kind,
      type,
    });

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success(type === "income" ? "Recebimento agendado!" : "Conta criada!");
      setCreateOpen(false);
      setTitle("");
      setAmount("");
      setDueDate("");
      setKind("other");
      setType("expense");
      loadPayments();
    }
    setLoading(false);
  }

  async function markAsDone(id: string) {
    const payment = payments.find((p) => p.id === id);
    if (!payment) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isIncome = payment.type === "income";

    const { data: txData, error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      wallet_id: walletId,
      type: isIncome ? "income" as const : "expense" as const,
      amount_cents: payment.amount_cents,
      date: payment.due_date,
      description: payment.title,
      payment_method: "other" as const,
    }).select("id").single();

    if (txError) {
      toast.error("Erro ao criar lançamento: " + txError.message);
      return;
    }

    const { error } = await supabase
      .from("scheduled_payments")
      .update({ status: "paid", paid_transaction_id: txData?.id ?? null })
      .eq("id", id);

    if (error) {
      toast.error(isIncome ? "Erro ao marcar como recebido" : "Erro ao marcar como pago");
    } else {
      toast.success(isIncome ? "Recebido! Entrada criada automaticamente." : "Pago! Saída criada automaticamente.");
      loadPayments();
    }
  }

  function openEdit(p: ScheduledPayment) {
    setEditId(p.id);
    setEditTitle(p.title);
    setEditAmount((Number(p.amount_cents) / 100).toFixed(2));
    setEditDueDate(p.due_date);
    setEditKind(p.kind as ScheduledKind);
    setEditType(p.type || "expense");
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditLoading(true);
    const amountCents = Math.round(parseFloat(editAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Valor inválido");
      setEditLoading(false);
      return;
    }
    const { error } = await supabase
      .from("scheduled_payments")
      .update({
        title: editTitle,
        amount_cents: amountCents,
        due_date: editDueDate,
        kind: editKind,
        type: editType,
      })
      .eq("id", editId);

    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
    } else {
      toast.success("Conta atualizada!");
      setEditOpen(false);
      loadPayments();
    }
    setEditLoading(false);
  }

  async function handleDelete() {
    setDeleteLoading(true);
    const { error } = await supabase
      .from("scheduled_payments")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Conta excluída!");
      setDeleteOpen(false);
      loadPayments();
    }
    setDeleteLoading(false);
  }

  const statusLabel = (p: ScheduledPayment) => {
    if (p.status === "paid") return p.type === "income" ? "Recebido" : "Pago";
    if (p.status === "pending") return "Pendente";
    if (p.status === "overdue") return p.type === "income" ? "Atrasado" : "Atrasado";
    return "Cancelado";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nova conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo agendamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    type === "income"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 ring-2 ring-green-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <TrendingUp className="h-4 w-4" />
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    type === "expense"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 ring-2 ring-red-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <TrendingDown className="h-4 w-4" />
                  Saída
                </button>
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  placeholder={type === "income" ? "Ex: Freelance, Salário..." : "Ex: Cartão Nubank, Aluguel..."}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label>{type === "income" ? "Data prevista" : "Vencimento"}</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              {type === "expense" && (
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as ScheduledKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(kindLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : type === "income" ? "Agendar recebimento" : "Criar conta"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CalendarClock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma conta futura cadastrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const isIncome = p.type === "income";
            const isActive = p.status === "pending" || p.status === "overdue";
            return (
              <Card key={p.id} className={isIncome ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500"}>
                <CardContent className="py-3 px-4">
                  {/* Row 1: Title + Value */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{p.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isIncome ? "Previsão" : "Vence"}: {new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className={`text-base font-bold shrink-0 ${isIncome ? "text-green-500" : "text-red-500"}`}>
                      {isIncome ? "+" : "-"}{formatCurrency(Number(p.amount_cents))}
                    </span>
                  </div>
                  {/* Row 2: Badges + Actions */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[p.status] ?? ""}`}>
                        {statusLabel(p)}
                      </Badge>
                      {isIncome ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-600 dark:text-green-400">
                          Entrada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {kindLabels[p.kind] ?? p.kind}
                        </Badge>
                      )}
                    </div>
                    {isActive && (
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => markAsDone(p.id)}
                          title={isIncome ? "Receber" : "Pagar"}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(p)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => { setDeleteId(p.id); setDeleteOpen(true); }}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar agendamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditType("income")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  editType === "income"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 ring-2 ring-green-500"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setEditType("expense")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  editType === "expense"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 ring-2 ring-red-500"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <TrendingDown className="h-4 w-4" />
                Saída
              </button>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>{editType === "income" ? "Data prevista" : "Vencimento"}</Label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                required
              />
            </div>
            {editType === "expense" && (
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={editKind} onValueChange={(v) => setEditKind(v as ScheduledKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(kindLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={editLoading}>
              {editLoading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
