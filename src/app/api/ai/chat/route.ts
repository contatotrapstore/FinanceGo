import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CategoryJoin = { name: string } | null;

export async function POST(request: Request) {
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        content:
          "A chave da API da OpenAI nao esta configurada. Adicione OPENAI_API_KEY no arquivo .env.local para ativar o chat com IA.",
      },
      { status: 200 }
    );
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  let messages;
  try {
    const body = await request.json();
    messages = body.messages;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido" }, { status: 400 });
  }
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Campo 'messages' e obrigatorio" }, { status: 400 });
  }
  // Fetch user financial data for context
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const [transactionsRes, scheduledRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount_cents, description, date, categories(name)")
      .eq("user_id", user.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth),
    supabase
      .from("scheduled_payments")
      .select("title, amount_cents, due_date, status, kind")
      .eq("user_id", user.id)
      .eq("status", "pending"),
  ]);
  const transactions = transactionsRes.data ?? [];
  const scheduled = scheduledRes.data ?? [];
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount_cents), 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount_cents), 0);
  const pendingTotal = scheduled.reduce((s, p) => s + Number(p.amount_cents), 0);
  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const systemPrompt = `Voce e o assistente financeiro do FinanceGO. Responda em portugues brasileiro.
Use os dados reais do usuario para responder:

RESUMO DE ${monthName.toUpperCase()}:
- Entradas: R$ ${(income / 100).toFixed(2)}
- Saidas: R$ ${(expense / 100).toFixed(2)}
- Saldo do mes: R$ ${((income - expense) / 100).toFixed(2)}
- Contas pendentes: R$ ${(pendingTotal / 100).toFixed(2)}
- Saldo previsto (apos pagar pendentes): R$ ${((income - expense - pendingTotal) / 100).toFixed(2)}

TRANSACOES DO MES:
${transactions.map((t) => `${t.type === "income" ? "+" : "-"} R$ ${(Number(t.amount_cents) / 100).toFixed(2)} - ${t.description || "sem descricao"} (${(t.categories as CategoryJoin)?.name || "sem categoria"}) em ${t.date}`).join("\n") || "Nenhuma transacao"}

CONTAS PENDENTES:
${scheduled.map((p) => `- ${p.title}: R$ ${(Number(p.amount_cents) / 100).toFixed(2)} vence ${p.due_date}`).join("\n") || "Nenhuma conta pendente"}

Regras:
- Sempre cite o periodo (ex: "em fevereiro/2026")
- Seja objetivo, com numeros e proximos passos
- Nao de conselho financeiro profissional, apenas organizacao pessoal
- Quando nao tiver dados suficientes, avise`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.error?.message || "Erro na API OpenAI" },
        { status: 500 }
      );
    }
    const data = await response.json();
    return NextResponse.json({
      content: data.choices[0].message.content,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}