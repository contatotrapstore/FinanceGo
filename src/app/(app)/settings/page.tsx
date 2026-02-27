"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { toast } from "sonner";
import { User, Palette, LogOut, Tag, Plus, Pencil, Trash2, Bell, CreditCard, Landmark } from "lucide-react";
import { createClient as createUntyped } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type CategoryType = Database["public"]["Enums"]["category_type"];

type Category = {
  id: string;
  user_id: string | null;
  name: string;
  type: string;
  color: string | null;
};

type CCard = {
  id: string;
  name: string;
  bank_name: string | null;
  last_four: string | null;
  credit_limit_cents: number;
  closing_day: number;
  payment_day: number;
  color: string;
  status: string;
};

type Loan = {
  id: string;
  name: string;
  lender: string | null;
  total_amount_cents: number;
  monthly_payment_cents: number;
  total_installments: number;
  paid_installments: number;
  interest_rate_pct: number;
  start_date: string;
  status: string;
  notes: string | null;
};

const cardColors = [
  "#7C3AED", "#8B5CF6", "#6366F1", "#3B82F6", "#0EA5E9",
  "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#1F2937",
];

const typeLabels: Record<string, string> = {
  income: "Entrada",
  expense: "Saída",
  both: "Ambos",
};

const defaultColors = [
  "#60A5FA", "#34D399", "#FBBF24", "#F87171", "#A78BFA",
  "#F472B6", "#38BDF8", "#FB923C", "#94A3B8", "#6EE7B7",
];

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<CategoryType>("expense");
  const [catColor, setCatColor] = useState("#60A5FA");
  const [catLoading, setCatLoading] = useState(false);

  // Edit category
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editCatId, setEditCatId] = useState("");
  const [editCatName, setEditCatName] = useState("");
  const [editCatType, setEditCatType] = useState<CategoryType>("expense");
  const [editCatColor, setEditCatColor] = useState("#60A5FA");
  const [editCatLoading, setEditCatLoading] = useState(false);

  // Delete category
  const [deleteCatOpen, setDeleteCatOpen] = useState(false);
  const [deleteCatId, setDeleteCatId] = useState("");
  const [deleteCatLoading, setDeleteCatLoading] = useState(false);

  // Credit cards
  const [cards, setCards] = useState<CCard[]>([]);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardBank, setCardBank] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cardClosing, setCardClosing] = useState("1");
  const [cardPayment, setCardPayment] = useState("10");
  const [cardColor, setCardColor] = useState("#7C3AED");
  const [cardLoading, setCardLoading] = useState(false);
  const [editCardOpen, setEditCardOpen] = useState(false);
  const [editCardId, setEditCardId] = useState("");
  const [editCardName, setEditCardName] = useState("");
  const [editCardBank, setEditCardBank] = useState("");
  const [editCardLast4, setEditCardLast4] = useState("");
  const [editCardLimit, setEditCardLimit] = useState("");
  const [editCardClosing, setEditCardClosing] = useState("1");
  const [editCardPayment, setEditCardPayment] = useState("10");
  const [editCardColor, setEditCardColor] = useState("#7C3AED");
  const [editCardLoading, setEditCardLoading] = useState(false);
  const [deleteCardOpen, setDeleteCardOpen] = useState(false);
  const [deleteCardId, setDeleteCardId] = useState("");
  const [deleteCardLoading, setDeleteCardLoading] = useState(false);

  // Loans
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanOpen, setLoanOpen] = useState(false);
  const [loanName, setLoanName] = useState("");
  const [loanLender, setLoanLender] = useState("");
  const [loanTotal, setLoanTotal] = useState("");
  const [loanMonthly, setLoanMonthly] = useState("");
  const [loanInstallments, setLoanInstallments] = useState("");
  const [loanPaid, setLoanPaid] = useState("0");
  const [loanRate, setLoanRate] = useState("");
  const [loanStart, setLoanStart] = useState("");
  const [loanNotes, setLoanNotes] = useState("");
  const [loanLoading, setLoanLoading] = useState(false);
  const [editLoanOpen, setEditLoanOpen] = useState(false);
  const [editLoanId, setEditLoanId] = useState("");
  const [editLoanName, setEditLoanName] = useState("");
  const [editLoanLender, setEditLoanLender] = useState("");
  const [editLoanTotal, setEditLoanTotal] = useState("");
  const [editLoanMonthly, setEditLoanMonthly] = useState("");
  const [editLoanInstallments, setEditLoanInstallments] = useState("");
  const [editLoanPaid, setEditLoanPaid] = useState("0");
  const [editLoanRate, setEditLoanRate] = useState("");
  const [editLoanStart, setEditLoanStart] = useState("");
  const [editLoanNotes, setEditLoanNotes] = useState("");
  const [editLoanLoading, setEditLoanLoading] = useState(false);
  const [deleteLoanOpen, setDeleteLoanOpen] = useState(false);
  const [deleteLoanId, setDeleteLoanId] = useState("");
  const [deleteLoanLoading, setDeleteLoanLoading] = useState(false);

  // Notifications
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const supabase = createClient();
  const db = createUntyped(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const router = useRouter();

  const loadCategories = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("categories")
      .select("id, user_id, name, type, color")
      .or(`user_id.eq.${uid},user_id.is.null`)
      .order("name");
    if (data) setCategories(data);
  }, []);

  const loadCards = useCallback(async (uid: string) => {
    const { data } = await db.from("credit_cards").select("*").eq("user_id", uid).eq("status", "active").order("name");
    if (data) setCards(data as CCard[]);
  }, []);

  const loadLoans = useCallback(async (uid: string) => {
    const { data } = await db.from("loans").select("*").eq("user_id", uid).eq("status", "active").order("name");
    if (data) setLoans(data as Loan[]);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email ?? "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .maybeSingle();
        if (profile) setName(profile.name);
        loadCategories(user.id);
        loadCards(user.id);
        loadLoans(user.id);
      }

      // Check push notification support
      if ("serviceWorker" in navigator && "PushManager" in window) {
        setPushSupported(true);
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      }
    }
    load();
  }, [loadCategories, loadCards, loadLoans]);

  async function handleSave() {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Perfil atualizado!");
    }
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatLoading(true);
    const { error } = await supabase.from("categories").insert({
      user_id: userId,
      name: catName,
      type: catType,
      color: catColor,
    });
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Categoria criada!");
      setCatOpen(false);
      setCatName("");
      setCatType("expense");
      setCatColor("#60A5FA");
      loadCategories(userId);
    }
    setCatLoading(false);
  }

  function openEditCategory(c: Category) {
    setEditCatId(c.id);
    setEditCatName(c.name);
    setEditCatType(c.type as CategoryType);
    setEditCatColor(c.color ?? "#60A5FA");
    setEditCatOpen(true);
  }

  async function handleEditCategory(e: React.FormEvent) {
    e.preventDefault();
    setEditCatLoading(true);
    const { error } = await supabase
      .from("categories")
      .update({ name: editCatName, type: editCatType as CategoryType, color: editCatColor })
      .eq("id", editCatId);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Categoria atualizada!");
      setEditCatOpen(false);
      loadCategories(userId);
    }
    setEditCatLoading(false);
  }

  async function handleDeleteCategory() {
    setDeleteCatLoading(true);
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", deleteCatId);
    if (error) {
      if (error.message.includes("foreign") || error.message.includes("constraint")) {
        toast.error("Esta categoria está em uso. Remova os lançamentos associados primeiro.");
      } else {
        toast.error("Erro: " + error.message);
      }
    } else {
      toast.success("Categoria excluída!");
      setDeleteCatOpen(false);
      loadCategories(userId);
    }
    setDeleteCatLoading(false);
  }

  async function handleCreateCard(e: React.FormEvent) {
    e.preventDefault();
    setCardLoading(true);
    const limitCents = Math.round(parseFloat(cardLimit) * 100);
    if (isNaN(limitCents) || limitCents <= 0) { toast.error("Limite inválido"); setCardLoading(false); return; }
    const { error } = await db.from("credit_cards").insert({
      user_id: userId, name: cardName, bank_name: cardBank || null, last_four: cardLast4 || null,
      credit_limit_cents: limitCents, closing_day: parseInt(cardClosing), payment_day: parseInt(cardPayment), color: cardColor,
    });
    if (error) { toast.error("Erro: " + error.message); }
    else {
      toast.success("Cartão adicionado!");
      setCardOpen(false); setCardName(""); setCardBank(""); setCardLast4(""); setCardLimit(""); setCardClosing("1"); setCardPayment("10"); setCardColor("#7C3AED");
      loadCards(userId);
    }
    setCardLoading(false);
  }

  function openEditCard(c: CCard) {
    setEditCardId(c.id); setEditCardName(c.name); setEditCardBank(c.bank_name ?? ""); setEditCardLast4(c.last_four ?? "");
    setEditCardLimit((c.credit_limit_cents / 100).toFixed(2)); setEditCardClosing(String(c.closing_day)); setEditCardPayment(String(c.payment_day)); setEditCardColor(c.color);
    setEditCardOpen(true);
  }

  async function handleEditCard(e: React.FormEvent) {
    e.preventDefault();
    setEditCardLoading(true);
    const limitCents = Math.round(parseFloat(editCardLimit) * 100);
    if (isNaN(limitCents) || limitCents <= 0) { toast.error("Limite inválido"); setEditCardLoading(false); return; }
    const { error } = await db.from("credit_cards").update({
      name: editCardName, bank_name: editCardBank || null, last_four: editCardLast4 || null,
      credit_limit_cents: limitCents, closing_day: parseInt(editCardClosing), payment_day: parseInt(editCardPayment), color: editCardColor,
    }).eq("id", editCardId);
    if (error) { toast.error("Erro: " + error.message); }
    else { toast.success("Cartão atualizado!"); setEditCardOpen(false); loadCards(userId); }
    setEditCardLoading(false);
  }

  async function handleDeleteCard() {
    setDeleteCardLoading(true);
    const { error } = await db.from("credit_cards").update({ status: "inactive" }).eq("id", deleteCardId);
    if (error) { toast.error("Erro: " + error.message); }
    else { toast.success("Cartão removido!"); setDeleteCardOpen(false); loadCards(userId); }
    setDeleteCardLoading(false);
  }

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault();
    setLoanLoading(true);
    const totalCents = Math.round(parseFloat(loanTotal) * 100);
    const monthlyCents = Math.round(parseFloat(loanMonthly) * 100);
    if (isNaN(totalCents) || totalCents <= 0) { toast.error("Valor total inválido"); setLoanLoading(false); return; }
    if (isNaN(monthlyCents) || monthlyCents <= 0) { toast.error("Parcela mensal inválida"); setLoanLoading(false); return; }
    const { error } = await db.from("loans").insert({
      user_id: userId, name: loanName, lender: loanLender || null,
      total_amount_cents: totalCents, monthly_payment_cents: monthlyCents,
      total_installments: parseInt(loanInstallments) || 1, paid_installments: parseInt(loanPaid) || 0,
      interest_rate_pct: parseFloat(loanRate) || 0, start_date: loanStart || new Date().toISOString().split("T")[0],
      notes: loanNotes || null,
    });
    if (error) { toast.error("Erro: " + error.message); }
    else {
      toast.success("Empréstimo adicionado!");
      setLoanOpen(false); setLoanName(""); setLoanLender(""); setLoanTotal(""); setLoanMonthly("");
      setLoanInstallments(""); setLoanPaid("0"); setLoanRate(""); setLoanStart(""); setLoanNotes("");
      loadLoans(userId);
    }
    setLoanLoading(false);
  }

  function openEditLoan(l: Loan) {
    setEditLoanId(l.id); setEditLoanName(l.name); setEditLoanLender(l.lender ?? "");
    setEditLoanTotal((l.total_amount_cents / 100).toFixed(2)); setEditLoanMonthly((l.monthly_payment_cents / 100).toFixed(2));
    setEditLoanInstallments(String(l.total_installments)); setEditLoanPaid(String(l.paid_installments));
    setEditLoanRate(String(l.interest_rate_pct)); setEditLoanStart(l.start_date); setEditLoanNotes(l.notes ?? "");
    setEditLoanOpen(true);
  }

  async function handleEditLoan(e: React.FormEvent) {
    e.preventDefault();
    setEditLoanLoading(true);
    const totalCents = Math.round(parseFloat(editLoanTotal) * 100);
    const monthlyCents = Math.round(parseFloat(editLoanMonthly) * 100);
    if (isNaN(totalCents) || totalCents <= 0) { toast.error("Valor total inválido"); setEditLoanLoading(false); return; }
    if (isNaN(monthlyCents) || monthlyCents <= 0) { toast.error("Parcela mensal inválida"); setEditLoanLoading(false); return; }
    const paid = parseInt(editLoanPaid) || 0;
    const total = parseInt(editLoanInstallments) || 1;
    const status = paid >= total ? "completed" : "active";
    const { error } = await db.from("loans").update({
      name: editLoanName, lender: editLoanLender || null,
      total_amount_cents: totalCents, monthly_payment_cents: monthlyCents,
      total_installments: total, paid_installments: paid,
      interest_rate_pct: parseFloat(editLoanRate) || 0, start_date: editLoanStart,
      notes: editLoanNotes || null, status,
    }).eq("id", editLoanId);
    if (error) { toast.error("Erro: " + error.message); }
    else { toast.success("Empréstimo atualizado!"); setEditLoanOpen(false); loadLoans(userId); }
    setEditLoanLoading(false);
  }

  async function handleDeleteLoan() {
    setDeleteLoanLoading(true);
    const { error } = await db.from("loans").delete().eq("id", deleteLoanId);
    if (error) { toast.error("Erro: " + error.message); }
    else { toast.success("Empréstimo excluído!"); setDeleteLoanOpen(false); loadLoans(userId); }
    setDeleteLoanLoading(false);
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function togglePush() {
    if (!pushSupported) return;
    setPushLoading(true);

    try {
      const reg = await navigator.serviceWorker.ready;

      if (pushEnabled) {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
        }
        setPushEnabled(false);
        toast.success("Notificações desativadas");
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Permissão de notificação negada");
          setPushLoading(false);
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ),
        });

        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          }),
        });

        setPushEnabled(true);
        toast.success("Notificações ativadas!");
      }
    } catch {
      toast.error("Erro ao alterar notificações");
    }

    setPushLoading(false);
  }

  const userCategories = categories.filter((c) => c.user_id === userId);
  const systemCategories = categories.filter((c) => c.user_id === null);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Configurações</h1>
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Categorias
            </CardTitle>
            <Dialog open={catOpen} onOpenChange={setCatOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Nova
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova categoria</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCategory} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="Ex: Mercado, Transporte..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={catType} onValueChange={(v) => setCatType(v as CategoryType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Saída</SelectItem>
                        <SelectItem value="income">Entrada</SelectItem>
                        <SelectItem value="both">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex gap-2 flex-wrap">
                      {defaultColors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`w-8 h-8 rounded-full border-2 ${catColor === c ? "border-foreground" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setCatColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={catLoading}>
                    {catLoading ? "Salvando..." : "Criar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {userCategories.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Suas categorias</p>
              <div className="space-y-1">
                {userCategories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color ?? "#94A3B8" }} />
                      <span className="text-sm">{c.name}</span>
                      <span className="text-xs text-muted-foreground">({typeLabels[c.type] ?? c.type})</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => openEditCategory(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                        onClick={() => { setDeleteCatId(c.id); setDeleteCatOpen(true); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {systemCategories.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Categorias padrão</p>
              <div className="space-y-1">
                {systemCategories.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 py-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color ?? "#94A3B8" }} />
                    <span className="text-sm text-muted-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">({typeLabels[c.type] ?? c.type})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma categoria encontrada.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Credit Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Meus Cartões
            </CardTitle>
            <Dialog open={cardOpen} onOpenChange={setCardOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Novo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Adicionar cartão</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateCard} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome do cartão</Label>
                    <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ex: Nubank, Inter..." required />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Banco</Label>
                      <Input value={cardBank} onChange={(e) => setCardBank(e.target.value)} placeholder="Nu Pagamentos" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Últimos 4 dígitos</Label>
                      <Input value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" maxLength={4} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Limite (R$)</Label>
                    <Input type="number" step="0.01" min="0.01" value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} placeholder="5000.00" required inputMode="decimal" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Dia fechamento</Label>
                      <Input type="number" min="1" max="31" value={cardClosing} onChange={(e) => setCardClosing(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Dia vencimento</Label>
                      <Input type="number" min="1" max="31" value={cardPayment} onChange={(e) => setCardPayment(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cor</Label>
                    <div className="flex gap-2 flex-wrap">
                      {cardColors.map((c) => (
                        <button key={c} type="button" className={`w-7 h-7 rounded-full border-2 ${cardColor === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setCardColor(c)} />
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={cardLoading}>{cardLoading ? "Salvando..." : "Adicionar"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum cartão cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {cards.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: c.color }}>
                      {c.last_four || "****"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Limite: R$ {(c.credit_limit_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · Fecha dia {c.closing_day} · Vence dia {c.payment_day}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => openEditCard(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive hover:text-destructive" onClick={() => { setDeleteCardId(c.id); setDeleteCardOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loans */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Meus Empréstimos
            </CardTitle>
            <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Novo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Adicionar empréstimo</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateLoan} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={loanName} onChange={(e) => setLoanName(e.target.value)} placeholder="Ex: Empréstimo Nubank" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Credor / Banco</Label>
                    <Input value={loanLender} onChange={(e) => setLoanLender(e.target.value)} placeholder="Ex: Nubank, Mercado Pago, Mãe..." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Valor total (R$)</Label>
                      <Input type="number" step="0.01" min="0.01" value={loanTotal} onChange={(e) => setLoanTotal(e.target.value)} required inputMode="decimal" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Parcela mensal (R$)</Label>
                      <Input type="number" step="0.01" min="0.01" value={loanMonthly} onChange={(e) => setLoanMonthly(e.target.value)} required inputMode="decimal" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label>Total parcelas</Label>
                      <Input type="number" min="1" value={loanInstallments} onChange={(e) => setLoanInstallments(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Pagas</Label>
                      <Input type="number" min="0" value={loanPaid} onChange={(e) => setLoanPaid(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Juros % a.m.</Label>
                      <Input type="number" step="0.01" min="0" value={loanRate} onChange={(e) => setLoanRate(e.target.value)} placeholder="0.00" inputMode="decimal" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data início</Label>
                    <Input type="date" value={loanStart} onChange={(e) => setLoanStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Input value={loanNotes} onChange={(e) => setLoanNotes(e.target.value)} placeholder="Ex: Juros compostos, carência 3 meses..." />
                  </div>
                  <Button type="submit" className="w-full" disabled={loanLoading}>{loanLoading ? "Salvando..." : "Adicionar"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum empréstimo cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {loans.map((l) => {
                const remaining = l.total_installments - l.paid_installments;
                const pct = l.total_installments > 0 ? Math.round((l.paid_installments / l.total_installments) * 100) : 0;
                const remainingTotal = remaining * l.monthly_payment_cents;
                return (
                  <div key={l.id} className="py-2.5 px-3 rounded-lg bg-muted/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.lender ? `${l.lender} · ` : ""}
                          {l.paid_installments}/{l.total_installments} parcelas
                          {l.interest_rate_pct > 0 ? ` · ${l.interest_rate_pct}% a.m.` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => openEditLoan(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive hover:text-destructive" onClick={() => { setDeleteLoanId(l.id); setDeleteLoanOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="w-full bg-background rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>R$ {(l.monthly_payment_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</span>
                      <span>Falta R$ {(remainingTotal / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({remaining}x)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Aparência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">Tema</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pushSupported ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm">Lembretes de contas</span>
                <p className="text-xs text-muted-foreground">
                  Receba avisos de contas vencendo e atrasadas
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pushEnabled}
                onClick={togglePush}
                disabled={pushLoading}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  pushEnabled ? "bg-primary" : "bg-muted"
                } ${pushLoading ? "opacity-50" : ""}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    pushEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Notificações não suportadas neste navegador.
            </p>
          )}
          {pushEnabled && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Você receberá lembretes diários às 8h sobre contas pendentes.
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />
      {/* Sign Out */}
      <Button variant="destructive" onClick={handleSignOut} className="w-full">
        <LogOut className="h-4 w-4 mr-2" />
        Sair da conta
      </Button>

      {/* Edit Category Dialog */}
      <Dialog open={editCatOpen} onOpenChange={setEditCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditCategory} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={editCatType} onValueChange={(v) => setEditCatType(v as CategoryType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Saída</SelectItem>
                  <SelectItem value="income">Entrada</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {defaultColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${editCatColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setEditCatColor(c)}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={editCatLoading}>
              {editCatLoading ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={editCardOpen} onOpenChange={setEditCardOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar cartão</DialogTitle></DialogHeader>
          <form onSubmit={handleEditCard} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editCardName} onChange={(e) => setEditCardName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Banco</Label><Input value={editCardBank} onChange={(e) => setEditCardBank(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Últimos 4</Label><Input value={editCardLast4} onChange={(e) => setEditCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Limite (R$)</Label>
              <Input type="number" step="0.01" min="0.01" value={editCardLimit} onChange={(e) => setEditCardLimit(e.target.value)} required inputMode="decimal" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Dia fechamento</Label><Input type="number" min="1" max="31" value={editCardClosing} onChange={(e) => setEditCardClosing(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label>Dia vencimento</Label><Input type="number" min="1" max="31" value={editCardPayment} onChange={(e) => setEditCardPayment(e.target.value)} required /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {cardColors.map((c) => (
                  <button key={c} type="button" className={`w-7 h-7 rounded-full border-2 ${editCardColor === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setEditCardColor(c)} />
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={editCardLoading}>{editCardLoading ? "Salvando..." : "Salvar"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Card Dialog */}
      <Dialog open={deleteCardOpen} onOpenChange={setDeleteCardOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remover cartão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza? O cartão será desativado mas os lançamentos associados serão mantidos.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteCardOpen(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDeleteCard} disabled={deleteCardLoading}>{deleteCardLoading ? "Removendo..." : "Remover"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Loan Dialog */}
      <Dialog open={editLoanOpen} onOpenChange={setEditLoanOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar empréstimo</DialogTitle></DialogHeader>
          <form onSubmit={handleEditLoan} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editLoanName} onChange={(e) => setEditLoanName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Credor / Banco</Label>
              <Input value={editLoanLender} onChange={(e) => setEditLoanLender(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Valor total (R$)</Label>
                <Input type="number" step="0.01" min="0.01" value={editLoanTotal} onChange={(e) => setEditLoanTotal(e.target.value)} required inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label>Parcela mensal (R$)</Label>
                <Input type="number" step="0.01" min="0.01" value={editLoanMonthly} onChange={(e) => setEditLoanMonthly(e.target.value)} required inputMode="decimal" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Total parcelas</Label>
                <Input type="number" min="1" value={editLoanInstallments} onChange={(e) => setEditLoanInstallments(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Pagas</Label>
                <Input type="number" min="0" value={editLoanPaid} onChange={(e) => setEditLoanPaid(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Juros % a.m.</Label>
                <Input type="number" step="0.01" min="0" value={editLoanRate} onChange={(e) => setEditLoanRate(e.target.value)} inputMode="decimal" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data início</Label>
              <Input type="date" value={editLoanStart} onChange={(e) => setEditLoanStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={editLoanNotes} onChange={(e) => setEditLoanNotes(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={editLoanLoading}>{editLoanLoading ? "Salvando..." : "Salvar"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Loan Dialog */}
      <Dialog open={deleteLoanOpen} onOpenChange={setDeleteLoanOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir empréstimo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este empréstimo?</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteLoanOpen(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDeleteLoan} disabled={deleteLoanLoading}>{deleteLoanLoading ? "Excluindo..." : "Excluir"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={deleteCatOpen} onOpenChange={setDeleteCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir categoria</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza? Se houver lançamentos usando esta categoria, a exclusão será bloqueada.
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteCatOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDeleteCategory} disabled={deleteCatLoading}>
              {deleteCatLoading ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
