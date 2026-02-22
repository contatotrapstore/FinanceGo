import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CategoryJoin = { name: string } | null;

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_month_summary",
      description: "Retorna o resumo financeiro de um mes especifico: entradas, saidas, saldo, contas pendentes e saldo previsto.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Ano (ex: 2026)" },
          month: { type: "number", description: "Mes (1-12)" },
        },
        required: ["year", "month"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_upcoming_payments",
      description: "Retorna contas/pagamentos pendentes nos proximos N dias.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Numero de dias a frente (ex: 7, 15, 30)" },
        },
        required: ["days"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_category_breakdown",
      description: "Retorna os gastos por categoria de um mes especifico.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Ano (ex: 2026)" },
          month: { type: "number", description: "Mes (1-12)" },
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
    const startOfMonth = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];

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
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + days * 86400000).toISOString().split("T")[0];

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
        titulo: p.title,
        valor: `R$ ${(Number(p.amount_cents) / 100).toFixed(2)}`,
        vencimento: p.due_date,
        tipo: p.kind,
      }))
    );
  }

  if (toolName === "get_category_breakdown") {
    const { year, month } = args;
    const startOfMonth = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];

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

  return JSON.stringify({ error: "Funcao desconhecida" });
}

export async function POST(request: Request) {
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

  const now = new Date();
  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const systemPrompt = `Voce e o assistente financeiro do FinanceGO. Responda em portugues brasileiro.
Voce tem acesso a funcoes para consultar os dados financeiros do usuario.
Use as funcoes sempre que precisar de dados numericos atualizados.

Hoje e ${now.toLocaleDateString("pt-BR")} (${monthName}).

Regras:
- Sempre cite o periodo (ex: "em fevereiro/2026")
- Seja objetivo, com numeros e proximos passos
- Nao de conselho financeiro profissional, apenas organizacao pessoal
- Use as funcoes disponiveis para buscar dados antes de responder
- Quando nao tiver dados suficientes, avise`;

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
      content: assistantMessage.content || "Desculpe, nao consegui gerar uma resposta.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
