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
import { User, Palette, LogOut, Tag, Plus, Pencil, Trash2, Bell } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type CategoryType = Database["public"]["Enums"]["category_type"];

type Category = {
  id: string;
  user_id: string | null;
  name: string;
  type: string;
  color: string | null;
};

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

  // Notifications
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  const loadCategories = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("categories")
      .select("id, user_id, name, type, color")
      .or(`user_id.eq.${uid},user_id.is.null`)
      .order("name");
    if (data) setCategories(data);
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
  }, [loadCategories]);

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
