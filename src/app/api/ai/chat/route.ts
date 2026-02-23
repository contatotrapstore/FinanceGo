import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CategoryJoin = { name: string } | null;

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_month_summary",
      description: "Retorna o resumo financeiro de um mês específico: entradas, saídas, saldo, contas pendentes e saldo previsto.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Ano (ex: 2026)" },
          month: { type: "number", description: "Mês (1-12)" },
        },
        required: ["year", "month"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_upcoming_payments",
      description: "Retorna contas/pagamentos pendentes nos próximos N dias.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Número de dias à frente (ex: 7, 15, 30)" },
        },
        required: ["days"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_category_breakdown",
      description: "Retorna os gastos por categoria de um mês específico.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Ano (ex: 2026)" },
          month: { type: "number", description: "Mês (1-12)" },
        },
        required: ["year", "month"],
      },
    },
  },
];

async function handleToolCall(
  toolName: string,
  args: Record<string, any>,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  if (toolName === "get_month_summary") {
    const { year, month } = args;
    const pad = (n: number) => String(n).padStart(2, "0");
    const startOfMonth = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${pad(month)}-${pad(lastDay)}`;

    const { data: transactions } = await supabase
      .from("transactions")
      .select("type, amount_cents")
      .eq("user_id", userId)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth);

    const { data: scheduled } = await supabase
      .from("scheduled_payments")
      .select("amount_cents, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("due_date", startOfMonth)
      .lte("due_date", endOfMonth);

    const txs = transactions ?? [];
    const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount_cents), 0);
    const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount_cents), 0);
    const pendingTotal = (scheduled ?? []).reduce((s, p) => s + Number(p.amount_cents), 0);

    return JSON.stringify({
      mes: `${month}/${year}`,
      entradas: `R$ ${(income / 100).toFixed(2)}`,
      saidas: `R$ ${(expense / 100).toFixed(2)}`,
      saldo_mes: `R$ ${((income - expense) / 100).toFixed(2)}`,
      contas_pendentes: `R$ ${(pendingTotal / 100).toFixed(2)}`,
      saldo_previsto: `R$ ${((income - expense - pendingTotal) / 100).toFixed(2)}`,
    });
  }

  if (toolName === "get_upcoming_payments") {
    const { days } = args;
    const now = new Date();
    const today = localDate(now);
    const futureDate = new Date(now.getTime() + days * 86400000);
    const future = localDate(futureDate);

    const { data } = await supabase
      .from("scheduled_payments")
      .select("title, amount_cents, due_date, kind, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("due_date", today)
      .lte("due_date", future)
      .order("due_date", { ascending: true });

    return JSON.stringify(
      (data ?? []).map((p) => ({
        título: p.title,
        valor: `R$ ${(Number(p.amount_cents) / 100).toFixed(2)}`,
        vencimento: p.due_date,
        tipo: p.kind,
      }))
    );
  }

  if (toolName === "get_category_breakdown") {
    const { year, month } = args;
    const pad = (n: number) => String(n).padStart(2, "0");
    const startOfMonth = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${pad(month)}-${pad(lastDay)}`;

    const { data: expenses } = await supabase
      .from("transactions")
      .select("amount_cents, categories(name)")
      .eq("type", "expense")
      .eq("user_id", userId)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth);

    const map = new Map<string, number>();
    (expenses ?? []).forEach((t) => {
      const catName = (t.categories as CategoryJoin)?.name ?? "Sem categoria";
      map.set(catName, (map.get(catName) ?? 0) + Number(t.amount_cents));
    });

    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => ({
        categoria: name,
        total: `R$ ${(total / 100).toFixed(2)}`,
      }));

    return JSON.stringify(sorted);
  }

  return JSON.stringify({ error: "Função desconhecida" });
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        content:
          "A chave da API da OpenAI não está configurada. Adicione OPENAI_API_KEY no arquivo .env.local para ativar o chat com IA.",
      },
      { status: 200 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let messages;
  try {
    const body = await request.json();
    messages = body.messages;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Campo 'messages' é obrigatório" }, { status: 400 });
  }

  const now = new Date();
  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const systemPrompt = `Você é o assistente financeiro do FinanceGO. Responda em português brasileiro.
Você tem acesso a funções para consultar os dados financeiros do usuário.
Use as funções sempre que precisar de dados numéricos atualizados.

Hoje é ${now.toLocaleDateString("pt-BR")} (${monthName}).

Regras:
- Sempre cite o período (ex: "em fevereiro/2026")
- Seja objetivo, com números e próximos passos
- Não dê conselho financeiro profissional, apenas organização pessoal
- Use as funções disponíveis para buscar dados antes de responder
- Quando não tiver dados suficientes, avise`;

  try {
    const openaiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // First call - may include tool calls
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        tools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.error?.message || "Erro na API OpenAI" },
        { status: 500 }
      );
    }

    let data = await response.json();
    let assistantMessage = data.choices[0].message;

    // Handle tool calls (up to 3 rounds)
    let rounds = 0;
    while (assistantMessage.tool_calls && rounds < 3) {
      rounds++;
      openaiMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await handleToolCall(toolCall.function.name, args, user.id, supabase);

        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Call again with tool results
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: openaiMessages,
          tools,
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { error: errData.error?.message || "Erro na API OpenAI" },
          { status: 500 }
        );
      }

      data = await response.json();
      assistantMessage = data.choices[0].message;
    }

    return NextResponse.json({
      content: assistantMessage.content || "Desculpe, não consegui gerar uma resposta.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
