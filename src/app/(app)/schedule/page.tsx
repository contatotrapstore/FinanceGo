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
import { Plus, Check, CalendarClock, Pencil, Trash2 } from "lucide-react";
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
  const [walletId, setWalletId] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editKind, setEditKind] = useState<ScheduledKind>("other");
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
        // Refresh the data after update
        const { data: refreshed } = await supabase
          .from("scheduled_payments")
          .select("*")
          .eq("user_id", user.id)
          .order("due_date", { ascending: true });
        if (refreshed) setPayments(refreshed);
      } else {
        setPayments(data);
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
    });

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Conta criada!");
      setCreateOpen(false);
      setTitle("");
      setAmount("");
      setDueDate("");
      setKind("other");
      loadPayments();
    }
    setLoading(false);
  }

  async function markAsPaid(id: string) {
    const payment = payments.find((p) => p.id === id);
    if (!payment) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Use due_date for the transaction (preserves cash flow accuracy)
    const { data: txData, error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      wallet_id: walletId,
      type: "expense" as const,
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
      toast.error("Erro ao marcar como pago");
    } else {
      toast.success("Pago! Lançamento criado automaticamente.");
      loadPayments();
    }
  }

  function openEdit(p: ScheduledPayment) {
    setEditId(p.id);
    setEditTitle(p.title);
    setEditAmount((Number(p.amount_cents) / 100).toFixed(2));
    setEditDueDate(p.due_date);
    setEditKind(p.kind as ScheduledKind);
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
              <DialogTitle>Nova conta futura</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  placeholder="Ex: Cartão Nubank, Aluguel..."
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
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as ScheduledKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(kindLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Criar"}
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
          {payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <Badge className={`text-xs ${statusColors[p.status] ?? ""}`}>
                      {p.status === "pending" ? "Pendente" : p.status === "paid" ? "Pago" : p.status === "overdue" ? "Atrasado" : "Cancelado"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {kindLabels[p.kind] ?? p.kind}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vence: {new Date(p.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <span className="text-sm font-bold text-red-500">
                    {formatCurrency(Number(p.amount_cents))}
                  </span>
                  {p.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-10 w-10 p-0" onClick={() => markAsPaid(p.id)} title="Marcar como pago">
                        <Check className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-10 w-10 p-0" onClick={() => openEdit(p)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 w-10 p-0 text-destructive hover:text-destructive"
                        onClick={() => { setDeleteId(p.id); setDeleteOpen(true); }}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar conta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
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
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={editKind} onValueChange={(v) => setEditKind(v as ScheduledKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(kindLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
