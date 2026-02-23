"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Database } from "@/lib/supabase/types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type CategoryJoin = { name: string; color: string | null; icon: string | null } | null;

type Transaction = {
  id: string;
  type: string;
  amount_cents: number;
  date: string;
  description: string | null;
  category_id: string | null;
  payment_method: string;
  categories: CategoryJoin;
};

type Category = {
  id: string;
  name: string;
  type: string;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userId, setUserId] = useState("");
  const [walletId, setWalletId] = useState("");

  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [searchText, setSearchText] = useState("");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editType, setEditType] = useState<"income" | "expense">("expense");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>("pix");
  const [editDate, setEditDate] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const supabase = createClient();

  const loadTransactions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [year, month] = filterMonth.split("-").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    const startOfMonth = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${pad(month)}-${pad(lastDay)}`;

    let query = supabase
      .from("transactions")
      .select("id, type, amount_cents, date, description, category_id, payment_method, categories(name, color, icon)")
      .eq("user_id", user.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date", { ascending: false })
      .limit(100);

    if (filterType !== "all") {
      query = query.eq("type", filterType as "income" | "expense");
    }
    if (filterCategory !== "all") {
      query = query.eq("category_id", filterCategory);
    }

    const { data } = await query;
    let result = (data ?? []) as Transaction[];

    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (t) =>
          (t.description ?? "").toLowerCase().includes(lower) ||
          ((t.categories as CategoryJoin)?.name ?? "").toLowerCase().includes(lower)
      );
    }

    setTransactions(result);
  }, [filterMonth, filterType, filterCategory, searchText]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: cats } = await supabase
        .from("categories")
        .select("id, name, type")
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
    init();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  function openEdit(t: Transaction) {
    setEditId(t.id);
    setEditType(t.type as "income" | "expense");
    setEditAmount((Number(t.amount_cents) / 100).toFixed(2));
    setEditDescription(t.description ?? "");
    setEditCategoryId(t.category_id ?? "");
    setEditPaymentMethod(t.payment_method as PaymentMethod);
    setEditDate(t.date);
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
      .from("transactions")
      .update({
        type: editType,
        amount_cents: amountCents,
        description: editDescription,
        category_id: editCategoryId || null,
        payment_method: editPaymentMethod,
        date: editDate,
      })
      .eq("id", editId);

    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
    } else {
      toast.success("Lançamento atualizado!");
      setEditOpen(false);
      loadTransactions();
    }
    setEditLoading(false);
  }

  async function handleDelete() {
    setDeleteLoading(true);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Lançamento excluído!");
      setDeleteOpen(false);
      loadTransactions();
    }
    setDeleteLoading(false);
  }

  const editFilteredCategories = categories.filter(
    (c) => c.type === editType || c.type === "both"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lançamentos</h1>
        <Link href="/transactions/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Mês</Label>
              <Input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Entradas</SelectItem>
                  <SelectItem value="expense">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Busca</Label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Descrição..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction list */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Nenhum lançamento encontrado.</p>
            <Link href="/transactions/new" className="text-primary hover:underline text-sm mt-2 block">
              Criar primeiro lançamento
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {t.description || "Sem descrição"}
                    </p>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {(t.categories as CategoryJoin)?.name ?? "Sem categoria"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")} - {t.payment_method}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span
                    className={`text-sm font-bold ${
                      t.type === "income" ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {t.type === "income" ? "+" : "-"}
                    {formatCurrency(Number(t.amount_cents))}
                  </span>
                  <Button size="sm" variant="ghost" className="h-10 w-10 p-0" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-10 w-10 p-0 text-destructive hover:text-destructive"
                    onClick={() => { setDeleteId(t.id); setDeleteOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
            <DialogTitle>Editar lançamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={editType === "income" ? "default" : "outline"}
                className={`flex-1 ${editType === "income" ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
                onClick={() => setEditType("income")}
              >
                Entrada
              </Button>
              <Button
                type="button"
                variant={editType === "expense" ? "default" : "outline"}
                className={`flex-1 ${editType === "expense" ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
                onClick={() => setEditType("expense")}
              >
                Saída
              </Button>
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
              <Label>Descrição</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {editFilteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={editPaymentMethod} onValueChange={(v) => setEditPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
              />
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
            <DialogTitle>Excluir lançamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
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
