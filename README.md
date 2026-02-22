# FinanceGO

Sistema financeiro pessoal (SaaS) para controle de entradas, saidas, contas futuras e relatorios com assistente IA.

## Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Auth, Postgres, RLS, Realtime)
- **IA:** OpenAI API (gpt-4o-mini)
- **Deploy:** Vercel
- **PWA:** Instalavel no celular

## Setup

### Pre-requisitos

- Node.js 18+
- Conta Supabase com projeto configurado

### Variaveis de ambiente

Crie `.env.local` na raiz:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
OPENAI_API_KEY=sua_chave_openai
```

### Instalacao

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Estrutura

```
src/
  app/
    (app)/              # Rotas autenticadas (layout com sidebar/nav)
      dashboard/        # Resumo mensal com cards
      transactions/     # Lista + formulario de lancamento
      schedule/         # Contas futuras
      reports/          # Graficos (pizza + barra)
      ai/               # Chat com IA
      settings/         # Perfil, tema, sair
    auth/               # Login/cadastro
    api/ai/chat/        # API route do chat IA
  components/
    ui/                 # Componentes shadcn/ui
    layout/             # Shell, navegacao, tema
  lib/
    supabase/           # Clients (browser + server) + tipos
    format.ts           # Formatacao de moeda e data
```

## Banco de dados

Supabase com RLS em todas as tabelas. Trigger `handle_new_user` cria automaticamente:
- Perfil do usuario
- Carteira padrao ("Conta Principal")
- 14 categorias padrao

Tabelas: `profiles`, `wallets`, `categories`, `transactions`, `scheduled_payments`, `ai_conversations`, `ai_messages`

## Design

- **Light:** fundo branco, azul bebe (#60A5FA)
- **Dark:** fundo #0B1220, cards #111C33
- **Mobile-first**, otimizado para uso com uma mao
- Valores em centavos (`amount_cents` bigint)

## Deploy

Conecte o repositorio ao Vercel e configure as variaveis de ambiente no dashboard.
