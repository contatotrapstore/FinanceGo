import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, categories(name, color, icon)")
    .order("date", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lancamentos</h1>
        <Link href="/transactions/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </Link>
      </div>

      {(!transactions || transactions.length === 0) ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Nenhum lancamento encontrado.</p>
            <Link href="/transactions/new" className="text-primary hover:underline text-sm mt-2 block">
              Criar primeiro lancamento
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
                      {t.description || "Sem descricao"}
                    </p>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {(t.categories as any)?.name ?? "Sem categoria"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")} - {t.payment_method}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold ml-3 shrink-0 ${
                    t.type === "income" ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(Number(t.amount_cents))}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
