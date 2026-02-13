# FinanceGO — Planejamento Completo (WebApp + PWA + Multiusuário + IA)
**Objetivo:** criar um sistema financeiro pessoal, mas já preparado para múltiplos usuários (SaaS simples), com entrada/saída rápida, agenda de contas futuras, visão do mês, e um chat com IA (OpenAI) para análise (“quanto falta ganhar”, “vou fechar negativo?”, “previsão de saldo”, etc.).  
**Stack:** Next.js (App Router) + Supabase (Auth/DB/Storage/Realtime) + Vercel (deploy) + PWA (instalável) + OpenAI API (chat).  
**Nome:** FinanceGO  
**Design:** azul bebê + branco; modo escuro com azul + gradiente leve; UI bonita, legível, super otimizada p/ mobile e desktop.

---

## 1) Problema que resolve
- Registrar rapidamente: “caiu um pix de X” → entra no saldo do mês (e no saldo atual).
- Registrar despesas: “paguei conta Y” → desconta do mês (e do saldo atual).
- Contas futuras: “daqui 2 dias pago cartão/emprestimo/fixas” → agendamento, alertas e impacto no “saldo previsto”.
- Visões claras:
  - **Saldo atual** (já caiu / já pagou)
  - **Saldo do mês** (competência do mês)
  - **Saldo previsto** (considerando contas agendadas)
- IA para responder:
  - “Quanto falta ganhar até o fim do mês pra não ficar negativo?”
  - “Se eu pagar tudo, fico com quanto?”
  - “Quais contas mais pesam?”
  - “Quanto sobra por semana se eu quiser guardar X?”

---

## 2) Principais módulos
1. **Auth & Multiusuário**
2. **Dashboard do mês**
3. **Lançamentos (entradas/saídas)**
4. **Contas e compromissos futuros (agenda)**
5. **Cartões / empréstimos (estrutura)**
6. **Metas e orçamento**
7. **Relatórios e insights**
8. **Chat IA FinanceGO**
9. **PWA + notificações**
10. **Admin SaaS (opcional) / compartilhamento**

---

## 3) MVP (primeira versão completa e útil)
### 3.1 Funcionalidades essenciais (MVP)
- Login / cadastro (Supabase Auth).
- Multiusuário (cada usuário vê somente seus dados).
- Dashboard do mês com:
  - Saldo atual
  - Entradas do mês
  - Saídas do mês
  - Saldo do mês
  - “Saldo previsto” (considerando agendados)
  - Lista “Próximos pagamentos” (7/15/30 dias)
- Lançamentos rápidos:
  - Adicionar entrada (valor, data, descrição, categoria, método: Pix/Dinheiro/Cartão/Transferência)
  - Adicionar saída (idem)
  - Marcar como “recorrente”
  - Upload de comprovante (opcional, Supabase Storage)
- Contas futuras:
  - Criar compromisso (valor, vencimento, tipo: cartão, empréstimo, fixa, variável, assinatura)
  - Status: pendente / pago / atrasado
  - Ao marcar “pago”, vira lançamento de saída automaticamente
- Categorias (padrão + custom):
  - Ex: Moradia, Contas, Alimentação, Transporte, Lazer, Saúde, Investimentos, Outros
- IA (chat):
  - Perguntas básicas com respostas usando dados do usuário
  - Ferramenta: “Resumo do mês” e “Projeção”
- PWA:
  - Instalável no celular
  - Offline básico (cache de UI e últimas telas)
  - “Adicionar lançamento rápido” otimizado para 1 mão

### 3.2 Fora do MVP (v2+)
- Open Banking / integração bancária automática
- OCR de comprovante/fatura
- Importação CSV/OFX
- Splits (dividir despesa com alguém)
- Multi-contas (carteiras separadas)
- Assinaturas com detecção automática
- Time/Family mode com permissões por membro

---

## 4) Modelagem de dados (Supabase)
### 4.1 Tabelas principais
**profiles**
- id (uuid, pk, = auth.users.id)
- name (text)
- created_at (timestamp)

**wallets** (para futuro multi-carteira; no MVP pode ter 1 padrão)
- id (uuid, pk)
- user_id (uuid, fk profiles.id)
- name (text) ex: “Pessoal”
- currency (text) default “BRL”
- created_at

**categories**
- id (uuid, pk)
- user_id (uuid, nullable) -> se null é categoria global/padrão
- name (text)
- type (enum: income | expense | both)
- icon (text) (opcional)
- color (text) (opcional)

**transactions**
- id (uuid, pk)
- user_id (uuid)
- wallet_id (uuid)
- type (enum: income | expense)
- amount_cents (bigint)  // evitar float
- date (date)            // data efetiva
- description (text)
- category_id (uuid)
- payment_method (enum: pix | cash | card | transfer | other)
- is_recurring (boolean)
- recurring_rule (text, nullable) // ex: RRULE simples ou "monthly"
- attachment_url (text, nullable)
- created_at

**scheduled_payments** (contas futuras / compromissos)
- id (uuid, pk)
- user_id (uuid)
- wallet_id (uuid)
- title (text) // “Cartão Nubank”, “Aluguel”, “Empréstimo”
- amount_cents (bigint)
- due_date (date)
- kind (enum: credit_card | loan | fixed_bill | subscription | variable_bill | other)
- status (enum: pending | paid | overdue | canceled)
- auto_convert_to_transaction (boolean default true)
- paid_transaction_id (uuid, nullable) // link quando pagar
- notes (text, nullable)
- created_at

**credit_cards** (v2, mas já estruturar)
- id (uuid)
- user_id (uuid)
- name (text)
- closing_day (int)
- due_day (int)
- limit_cents (bigint, nullable)
- created_at

**loans** (v2)
- id (uuid)
- user_id
- name
- principal_cents
- interest_rate (numeric, nullable)
- installments_total (int)
- created_at

**budgets** (metas/limites por categoria no mês)
- id (uuid)
- user_id
- month (date) // usar 1º dia do mês como referência
- category_id (uuid)
- limit_cents (bigint)

**ai_conversations**
- id (uuid)
- user_id
- created_at
- title (text)

**ai_messages**
- id (uuid)
- conversation_id (uuid)
- role (enum: user | assistant | system | tool)
- content (text)
- created_at

### 4.2 Regras de segurança (RLS)
- Habilitar RLS em todas tabelas user-owned.
- Policies:
  - `user_id = auth.uid()` para select/insert/update/delete.
- categories globais: permitir select para todos; insert/update/delete apenas para admin (ou não ter global e criar default por usuário no signup).

### 4.3 Triggers (automação)
- Ao marcar `scheduled_payments.status = paid`:
  - se `auto_convert_to_transaction = true` e `paid_transaction_id is null`:
    - criar `transactions` expense com mesmo valor/data/descrição
    - linkar `paid_transaction_id`
- Ao criar usuário (signup):
  - criar profile
  - criar wallet padrão “Pessoal”
  - criar categorias padrão

---

## 5) Cálculos-chave (regras do FinanceGO)
- **Entradas do mês:** soma transactions `type=income` com `date` no mês atual.
- **Saídas do mês:** soma `type=expense` com `date` no mês atual.
- **Saldo do mês:** entradas - saídas.
- **Saldo previsto (mês):** saldo do mês - soma scheduled_payments pendentes com due_date no mês.
- **Falta ganhar para não ficar negativo:** max(0, (saídas + pendentes) - entradas).
- **Próximos pagamentos:** scheduled_payments pendentes com due_date >= hoje e <= hoje+30.

---

## 6) UX / UI (Design System)
### 6.1 Identidade visual
- **Light mode:** fundo branco (#FFFFFF), azul bebê como primário (ex: #7DD3FC / #60A5FA vibe), cinzas suaves.
- **Dark mode:** fundo #0B1220 (ou #0F172A), cards em #111C33, acentos em azul.
- Gradiente suave em headers/botões: azul bebê → azul médio.
- Tipografia: **Inter** ou **DM Sans** (legível e moderna).
- Componentes com bordas arredondadas (12–16px), sombras leves, espaçamento generoso.

### 6.2 Layout mobile-first (PWA)
- Bottom nav (mobile): **Dashboard / Lançar / Agenda / Relatórios / IA**
- CTA central: “+ Lançamento” (rápido).
- Form de lançamento:
  - Valor grande (teclado numérico)
  - Toggle Entrada/Saída
  - Categoria (chips)
  - Data (hoje default)
  - Descrição (opcional)
  - Salvar

### 6.3 Desktop
- Sidebar à esquerda com menu
- Dashboard com cards + gráficos + tabela de lançamentos

---

## 7) Chat com IA (OpenAI) — comportamento e segurança
### 7.1 Objetivo do Chat
- Responder com base nos dados reais do usuário no Supabase.
- Ajudar com:
  - Projeções
  - Diagnóstico do mês
  - Sugestões de corte de gastos
  - Metas realistas
  - Alertas de risco (“você vai ficar negativo se pagar X e Y”)

### 7.2 Arquitetura do Chat
- UI chat no app
- Endpoint server-side (Next.js API route / server action) para chamar OpenAI.
- “Tool calling” (funções) para buscar dados:
  - `get_month_summary(month)`
  - `get_upcoming_payments(range_days)`
  - `get_category_breakdown(month)`
  - `get_cashflow_projection(month)`
- O modelo NUNCA acessa o banco direto: sempre por funções server-side com auth.
- Guardrails:
  - IA não dá conselho financeiro “profissional”, mas sim organização e análise pessoal.
  - Mensagens com números sempre citam período (ex: “Fevereiro/2026”).
  - Explica suposições (ex: “considerando apenas contas cadastradas”).

### 7.3 Exemplos de prompts do usuário
- “FinanceGO, se eu pagar tudo que falta esse mês, fico com quanto?”
- “Quanto preciso ganhar até dia 28 pra fechar no zero?”
- “Quais categorias eu mais gastei?”
- “Me faça um plano simples pra sobrar 500 por mês.”

---

## 8) Relatórios (MVP + extras)
### MVP
- Gráfico pizza (gastos por categoria no mês)
- Linha (saldo diário acumulado no mês)
- Lista top despesas
### Extra
- Comparativo mês anterior
- Tendência 3 meses
- “Gastos fixos vs variáveis”

---

## 9) PWA + Notificações
- PWA com manifest + service worker.
- Offline: cache de rotas principais + fallback.
- Notificações:
  - push/web (mais complexo) OU
  - notificações locais via lembretes dentro do app (v1)
- Lembretes: “vencimento em 2 dias” (agenda).

---

## 10) Rotas / Páginas (Next.js App Router)
- `/auth` (login/cadastro)
- `/dashboard` (visão do mês)
- `/transactions` (listagem + filtros)
- `/transactions/new` (lançamento rápido)
- `/schedule` (contas futuras)
- `/reports` (gráficos)
- `/ai` (chat)
- `/settings` (perfil, categorias, tema)

---

## 11) Componentes principais
- `MonthPicker`
- `SummaryCards` (saldo atual / mês / previsto)
- `QuickAddTransaction`
- `TransactionList` + filtros (categoria, tipo, período)
- `ScheduledPaymentsList` + ações (pagar/editar)
- `Charts` (Recharts)
- `AIChat` (mensagens + streaming)
- `ThemeToggle` (light/dark)

---

## 12) Filtros e busca
- Filtro por mês (padrão atual)
- Busca por texto (descrição)
- Filtro por categoria / tipo / método pagamento
- Ordenação por data/valor

---

## 13) Performance e qualidade
- Mobile-first, reduzir bundle.
- Server components onde fizer sentido.
- Paginação/virtualização na lista de lançamentos.
- Índices no Supabase:
  - transactions (user_id, date)
  - scheduled_payments (user_id, due_date, status)

---

## 14) Deploy e ambiente (Vercel + Supabase)
### Variáveis
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (somente server, cuidado)
- `OPENAI_API_KEY` (server only)
- `NEXT_PUBLIC_APP_NAME=FinanceGO`

### Deploy
- Vercel (preview + production)
- Supabase migrations versionadas (SQL)

---

## 15) Roadmap por etapas (execução)
### Etapa 1 — Base
- Projeto Next.js + Tailwind + shadcn/ui
- Supabase client + auth + layout
- Tema (light/dark)

### Etapa 2 — Dados
- Schema SQL + RLS + seeds categorias
- Wallet padrão
- CRUD transactions + scheduled

### Etapa 3 — Dashboard
- Cards + próximos pagamentos
- Saldo previsto e cálculos

### Etapa 4 — IA
- Chat UI + endpoint OpenAI
- Funções de consulta (tools)
- Respostas com números e períodos

### Etapa 5 — PWA
- Manifest + SW
- Instalação + ícones
- Ajustes mobile (bottom nav)

### Etapa 6 — Relatórios
- Gráficos + breakdown

---

## 16) Critérios de aceite (Definition of Done)
- Usuário cria conta e entra
- Registra entrada/saída e reflete imediatamente no dashboard
- Cria conta futura e aparece em “próximos pagamentos”
- Marca conta como paga e vira despesa automaticamente
- IA responde usando dados reais do mês
- PWA instalável e usável no celular
- RLS garante privacidade por usuário

---

## 17) Prompt para o Claude Code (copiar e colar)
Você é um engenheiro full-stack senior. Construa o **FinanceGO** seguindo este planejamento.
Requisitos obrigatórios:
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Auth, Postgres, RLS, Storage)
- Deploy na Vercel
- PWA instalável
- Modo claro e escuro (azul bebê + branco / dark azul)
- CRUD completo de `transactions` e `scheduled_payments`
- Dashboard com cálculos: saldo do mês, saldo previsto, quanto falta ganhar
- Chat com IA via OpenAI API com “tool calling” para buscar dados do Supabase de forma segura (server-side)
- UI 100% responsiva e otimizada mobile/desktop
Entregue:
1) Estrutura de pastas
2) SQL migrations (schema + RLS + triggers)
3) Componentes e páginas
4) Endpoints do chat IA
5) Setup PWA
6) Instruções de deploy (Vercel + Supabase)

Comece implementando o projeto base (etapa 1), depois schema e RLS (etapa 2), depois UI e features (etapas 3–6).

---

## 18) Extras criativos (opcionais, mas valiosos)
- “Comando rápido” tipo spotlight (Ctrl+K): “Adicionar Pix”, “Pagar conta”, “Ver projeção”
- “Resumo diário” no dashboard (mini feed)
- “Modo ultra rápido”: 2 campos (valor + descrição) e o resto por default
- “Insights” (IA): 3 bullets automáticos no topo do mês

---

## 19) Observações finais
- Tudo em centavos (amount_cents) para evitar erro.
- Sempre mostrar período e moeda.
- IA: respostas objetivas, com números e próximos passos (“quer que eu crie uma meta?”).

---
**FinanceGO** pronto para ser seu app financeiro pessoal e, quando quiser, virar um mini-SaaS para outros usuários.
