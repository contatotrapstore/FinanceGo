"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Check, CalendarClock } from "lucide-react";
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
  credit_card: "Cartao",
  loan: "Emprestimo",
  fixed_bill: "Conta Fixa",
  subscription: "Assinatura",
  variable_bill: "Conta Variavel",
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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [kind, setKind] = useState<ScheduledKind>("other");
  const [walletId, setWalletId] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const loadPayments = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("scheduled_payments")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true });
    if (data) setPayments(data);
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
      toast.error("Valor invalido");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Nao autenticado");
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
      setOpen(false);
      setTitle("");
      setAmount("");
      setDueDate("");
      setKind("other");
      loadPayments();
    }
    setLoading(false);
  }

  async function markAsPaid(id: string) {
    const { error } = await supabase
      .from("scheduled_payments")
      .update({ status: "paid" })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao marcar como pago");
    } else {
      toast.success("Marcado como pago! Lancamento criado automaticamente.");
      loadPayments();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <Dialog open={open} onOpenChange={setOpen}>
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
                <Label>Titulo</Label>
                <Input
                  placeholder="Ex: Cartao Nubank, Aluguel..."
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
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className="text-sm font-bold text-red-500">
                    {formatCurrency(Number(p.amount_cents))}
                  </span>
                  {p.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => markAsPaid(p.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
