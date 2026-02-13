# FinanceGO

## Projeto
Sistema financeiro pessoal (SaaS simples) com entrada/saida rapida, agenda de contas futuras, visao do mes e chat com IA.

## Stack
- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Auth, Postgres, RLS, Storage, Realtime)
- **IA:** OpenAI API (chat com tool calling)
- **Deploy:** Vercel
- **PWA:** Instalavel no celular

## Supabase
- **Project ID:** tphuewestveeiadtypnm
- **URL:** https://tphuewestveeiadtypnm.supabase.co
- **Region:** sa-east-1
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwaHVld2VzdHZlZWlhZHR5cG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTMxNTgsImV4cCI6MjA4NjU4OTE1OH0.6AjK9uZ-UfUKuGDffa6uy8BaFp1eBFvJDMnLTD3E88c

## Design System
- **Light mode:** fundo branco (#FFFFFF), azul bebe como primario (#7DD3FC / #60A5FA)
- **Dark mode:** fundo #0B1220, cards #111C33, acentos em azul
- **Tipografia:** Inter ou DM Sans
- **Bordas arredondadas:** 12-16px, sombras leves

## Convencoes
- Valores monetarios sempre em centavos (amount_cents) - bigint
- Sempre mostrar periodo e moeda (BRL)
- Mobile-first, UI otimizada para 1 mao
- Server components onde fizer sentido
- RLS em todas tabelas user-owned (user_id = auth.uid())

## Estrutura de Rotas
- `/auth` - login/cadastro
- `/dashboard` - visao do mes
- `/transactions` - listagem + filtros
- `/transactions/new` - lancamento rapido
- `/schedule` - contas futuras
- `/reports` - graficos
- `/ai` - chat IA
- `/settings` - perfil, categorias, tema
