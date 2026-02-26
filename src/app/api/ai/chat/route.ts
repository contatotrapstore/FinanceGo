import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CategoryJoin = { name: string } | null;

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const tools = [
  // === READ tools ===
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
  // === WRITE tools ===
  {
    type: "function" as const,
    function: {
      name: "create_transaction",
      description: "Cria um lançamento financeiro (entrada ou saída de dinheiro que já aconteceu). Use para registrar gastos realizados, salários recebidos, receitas, etc.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["income", "expense"], description: "Tipo: income = entrada/receita, expense = saída/gasto" },
          amount: { type: "number", description: "Valor em reais (ex: 300.00, 2000, 49.90)" },
          description: { type: "string", description: "Descrição do lançamento (ex: 'Salário', 'Almoço restaurante', 'Freelance')" },
          date: { type: "string", description: "Data no formato YYYY-MM-DD. Se não informado, usa hoje." },
          payment_method: { type: "string", enum: ["pix", "cash", "card", "transfer", "other"], description: "Método de pagamento. Padrão: pix" },
        },
        required: ["type", "amount", "description"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_scheduled_payment",
      description: "Cria um agendamento na Agenda (pagamento ou recebimento futuro). Use para contas mensais, parcelas, assinaturas, boletos futuros, freelances a receber, salários futuros, etc.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Nome (ex: 'Aluguel', 'Netflix', 'Freelance site', 'Salário')" },
          amount: { type: "number", description: "Valor em reais (ex: 50.00, 1200)" },
          due_date: { type: "string", description: "Data de vencimento/previsão no formato YYYY-MM-DD" },
          payment_type: { type: "string", enum: ["income", "expense"], description: "income = entrada/recebimento futuro, expense = conta/saída futura. Padrão: expense" },
          kind: { type: "string", enum: ["credit_card", "loan", "fixed_bill", "subscription", "variable_bill", "other"], description: "Categoria da conta (só para expense). Padrão: other" },
        },
        required: ["title", "amount", "due_date"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "mark_payment_paid",
      description: "Marca uma conta da Agenda como paga. Cria automaticamente um lançamento de saída. Use quando o usuário disser que pagou uma conta.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Nome da conta para buscar (busca parcial, ex: 'Nubank', 'Luz')" },
        },
        required: ["title"],
      },
    },
  },
];

async function getWalletId(userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data } = await supabase.from("wallets").select("id").eq("user_id", userId).limit(1);
  return data?.[0]?.id ?? null;
}

async function handleToolCall(
  toolName: string,
  args: Record<string, any>,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  cachedWalletId: string | null
): Promise<string> {
  // === READ tools ===
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
      .select("title, amount_cents, due_date, kind, status, type")
      .eq("user_id", userId)
      .in("status", ["pending", "overdue"])
      .gte("due_date", today)
      .lte("due_date", future)
      .order("due_date", { ascending: true });

    return JSON.stringify(
      (data ?? []).map((p) => ({
        título: p.title,
        valor: `R$ ${(Number(p.amount_cents) / 100).toFixed(2)}`,
        vencimento: p.due_date,
        tipo: p.kind,
        direção: p.type === "income" ? "recebimento" : "pagamento",
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

  // === WRITE tools ===
  if (toolName === "create_transaction") {
    if (!cachedWalletId) return JSON.stringify({ erro: "Carteira não encontrada" });

    const amountCents = Math.round((args.amount ?? 0) * 100);
    if (amountCents <= 0) return JSON.stringify({ erro: "Valor inválido. Informe um valor maior que zero." });
    if (!args.description || args.description.trim().length === 0) return JSON.stringify({ erro: "Descrição é obrigatória" });
    if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return JSON.stringify({ erro: "Data inválida. Use o formato YYYY-MM-DD" });

    const date = args.date || localDate(new Date());
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      wallet_id: cachedWalletId,
      type: args.type,
      amount_cents: amountCents,
      date,
      description: args.description.trim(),
      payment_method: args.payment_method || "pix",
    });

    if (error) return JSON.stringify({ erro: error.message });

    const typeLabel = args.type === "income" ? "Entrada" : "Saída";
    return JSON.stringify({
      sucesso: true,
      mensagem: `${typeLabel} de R$ ${args.amount.toFixed(2)} criada: "${args.description}" em ${date}`,
    });
  }

  if (toolName === "create_scheduled_payment") {
    if (!cachedWalletId) return JSON.stringify({ erro: "Carteira não encontrada" });

    const amountCents = Math.round((args.amount ?? 0) * 100);
    if (amountCents <= 0) return JSON.stringify({ erro: "Valor inválido. Informe um valor maior que zero." });
    if (!args.title || args.title.trim().length === 0) return JSON.stringify({ erro: "Título é obrigatório" });
    if (!args.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(args.due_date)) return JSON.stringify({ erro: "Data inválida. Use o formato YYYY-MM-DD" });

    const paymentType = args.payment_type || "expense";
    const { error } = await supabase.from("scheduled_payments").insert({
      user_id: userId,
      wallet_id: cachedWalletId,
      title: args.title.trim(),
      amount_cents: amountCents,
      due_date: args.due_date,
      kind: args.kind || "other",
      type: paymentType,
    });

    if (error) return JSON.stringify({ erro: error.message });

    const label = paymentType === "income" ? "Recebimento" : "Conta";
    return JSON.stringify({
      sucesso: true,
      mensagem: `${label} "${args.title}" de R$ ${args.amount.toFixed(2)} agendado na Agenda para ${args.due_date}`,
    });
  }

  if (toolName === "mark_payment_paid") {
    if (!cachedWalletId) return JSON.stringify({ erro: "Carteira não encontrada" });
    if (!args.title || args.title.trim().length < 2) {
      return JSON.stringify({ erro: "Informe pelo menos 2 caracteres do nome da conta" });
    }

    // Search for matching payments (up to 5)
    const { data: payments } = await supabase
      .from("scheduled_payments")
      .select("id, title, amount_cents, due_date, type")
      .eq("user_id", userId)
      .in("status", ["pending", "overdue"])
      .ilike("title", `%${args.title.trim()}%`)
      .order("due_date", { ascending: true })
      .limit(5);

    if (!payments || payments.length === 0) {
      return JSON.stringify({ erro: `Nenhuma conta pendente encontrada com "${args.title}"` });
    }

    // If multiple matches, ask user to choose
    if (payments.length > 1) {
      const options = payments.map((p) => ({
        titulo: p.title,
        valor: `R$ ${(Number(p.amount_cents) / 100).toFixed(2)}`,
        vencimento: p.due_date,
        tipo: p.type === "income" ? "recebimento" : "conta",
      }));
      return JSON.stringify({
        aviso: `Encontrei ${payments.length} contas com "${args.title}". Qual delas você quer marcar?`,
        opcoes: options,
      });
    }

    const payment = payments[0];
    const isIncome = payment.type === "income";

    // Create transaction with correct type
    const { data: txData, error: txError } = await supabase.from("transactions").insert({
      user_id: userId,
      wallet_id: cachedWalletId,
      type: isIncome ? "income" as const : "expense" as const,
      amount_cents: payment.amount_cents,
      date: payment.due_date,
      description: payment.title,
      payment_method: "other" as const,
    }).select("id").single();

    if (txError) return JSON.stringify({ erro: txError.message });

    // Mark as paid/received
    await supabase
      .from("scheduled_payments")
      .update({ status: "paid", paid_transaction_id: txData?.id ?? null })
      .eq("id", payment.id);

    const actionLabel = isIncome ? "recebida" : "paga";
    const txLabel = isIncome ? "Entrada" : "Saída";
    return JSON.stringify({
      sucesso: true,
      mensagem: `"${payment.title}" marcada como ${actionLabel}! ${txLabel} de R$ ${(payment.amount_cents / 100).toFixed(2)} criada em ${payment.due_date}`,
    });
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
Você tem acesso a funções para CONSULTAR e CRIAR dados financeiros do usuário.

Hoje é ${now.toLocaleDateString("pt-BR")} (${monthName}).

Funções disponíveis:
- CONSULTAR: resumo do mês, contas próximas, gastos por categoria
- CRIAR LANÇAMENTO: quando o usuário diz que gastou, recebeu, pagou algo HOJE ou no passado
- CRIAR CONTA NA AGENDA: quando o usuário diz que tem conta futura, parcela mensal, assinatura
- MARCAR COMO PAGO: quando o usuário diz que pagou uma conta da agenda

Regras:
- Sempre cite o período (ex: "em fevereiro/2026")
- Seja objetivo, com números e próximos passos
- Não dê conselho financeiro profissional, apenas organização pessoal
- Use as funções disponíveis para buscar dados antes de responder
- Quando não tiver dados suficientes, avise
- Após criar algo, confirme o que foi criado com os valores
- Se o usuário falar "gastei X em Y", crie como expense com data de hoje
- Se o usuário falar "recebi X" ou "entrou X", crie como income com data de hoje
- Se o usuário falar "tenho conta de X todo dia Y", crie como scheduled_payment com payment_type: "expense"
- Se o usuário falar "vou receber X", "tenho X pra receber", crie como scheduled_payment com payment_type: "income"
- Valores são em reais (BRL). Ex: "300 reais" = amount: 300`;

  try {
    let cachedWalletId: string | null = null;
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

    // Handle tool calls (up to 5 rounds for complex multi-step actions)
    let rounds = 0;
    while (assistantMessage.tool_calls && rounds < 5) {
      rounds++;
      openaiMessages.push(assistantMessage);

      // Pre-fetch wallet_id once for all tool calls
      if (!cachedWalletId) {
        cachedWalletId = await getWalletId(user.id, supabase);
      }

      for (const toolCall of assistantMessage.tool_calls) {
        let args: Record<string, any>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }
        const result = await handleToolCall(toolCall.function.name, args, user.id, supabase, cachedWalletId);

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
