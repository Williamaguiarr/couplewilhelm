
## Análise da referência visual

A partir do site e da logo enviados, identifiquei:
- **Logo**: símbolo arquitetônico (ponte + prédios) + texto "COUPLE WILHELM" em versalete serif cor #A3A38B (dourado/khaki)
- **Site**: fundo escuro azul-marinho (#0A192F), textos claros, tipografia elegant serif nos títulos, botões dourados, estilo concierge de luxo carioca
- **Tom**: sofisticado, premium, transparência como valor central

---

## Plano de Implementação Completo

### Fase 1 — Infraestrutura e Identidade Visual

**1.1 Logo e Assets**
- Copiar `LOGO_VERDE_CLARA.png` para `src/assets/logo.png`
- Google Fonts: `Playfair Display` (serif, títulos) + `Inter` (sans-serif, dados)

**1.2 Design System (`src/index.css`)**
- Atualizar variáveis CSS com paleta de luxo:
  - `--background`: `#0A192F` (azul-marinho profundo)
  - `--foreground`: `#F0EDE8` (branco creme)
  - `--primary`: `#A3A38B` (dourado/khaki da logo)
  - `--card`: `#0D2137` (azul ligeiramente mais claro para cards)
  - `--border`: `rgba(163, 163, 139, 0.2)` (borda sutil dourada)
  - `--muted`: `#1A3050`
- Animação de transição suave (fade + translateY) para rotas

---

### Fase 2 — Supabase: Banco de Dados e Autenticação

**2.1 Conexão Supabase**
- Arquivo `src/integrations/supabase/client.ts` e `types.ts`

**2.2 Migrations SQL**
```text
-- Enum de roles
create type app_role as enum ('admin', 'proprietario');

-- Perfis (espelha auth.users)
create table profiles (
  id uuid references auth.users primary key,
  email text,
  nome text,
  role app_role default 'proprietario'
);

-- Tabela de roles separada (segurança)
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  role app_role,
  unique(user_id, role)
);

-- Imóveis
create table imoveis (
  id uuid primary key default gen_random_uuid(),
  nome_imovel text not null,
  endereco text,
  proprietario_id uuid references profiles(id)
);

-- Reservas
create table reservas (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid references imoveis(id),
  data_inicio date not null,
  data_fim date not null,
  valor_bruto numeric(10,2),
  valor_liquido_proprietario numeric(10,2),
  created_at timestamptz default now()
);
```

**2.3 RLS Policies**
- `has_role()` função security definer
- `profiles`: usuário lê próprio perfil; admin lê todos
- `imoveis`: admin CRUD total; proprietario SELECT where `proprietario_id = auth.uid()`
- `reservas`: admin CRUD total; proprietario SELECT via join com imoveis

**2.4 Trigger `handle_new_user`**
- Ao criar usuário no Auth, insere registro em `profiles` automaticamente

---

### Fase 3 — Estrutura de Arquivos

```text
src/
├── assets/
│   └── logo.png
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx          # Sidebar esquerda com logo + nav
│   │   ├── TopBar.tsx           # Header com nome do usuário + logout
│   │   └── PageTransition.tsx   # Wrapper com animação fade/slide
│   ├── auth/
│   │   └── ProtectedRoute.tsx   # Guard por role
│   └── ui/ (shadcn - existentes)
├── contexts/
│   └── AuthContext.tsx          # Session + profile + role
├── hooks/
│   ├── useAuth.ts
│   ├── useImoveis.ts
│   └── useReservas.ts
├── pages/
│   ├── Login.tsx                # Tela de login elegante
│   ├── admin/
│   │   ├── AdminDashboard.tsx   # Visão geral admin
│   │   ├── Proprietarios.tsx    # Gestão de proprietários
│   │   ├── Imoveis.tsx          # Gestão de imóveis
│   │   └── Reservas.tsx         # Gestão de reservas
│   └── proprietario/
│       ├── Dashboard.tsx        # Cards + calendário
│       └── MeusImoveis.tsx      # Detalhes do imóvel (read-only)
├── integrations/
│   └── supabase/
│       ├── client.ts
│       └── types.ts
└── App.tsx                      # Rotas com proteção por role
```

---

### Fase 4 — Páginas e Componentes

**4.1 Página de Login (`Login.tsx`)**
- Fundo `#0A192F` com logo centralizada
- Card com borda dourada sutil, campos email/senha
- Botão "Entrar" dourado (#A3A38B)
- Ao autenticar: redireciona por role (admin → `/admin` | proprietario → `/dashboard`)

**4.2 Sidebar (`Sidebar.tsx`)**
- Logo Couple Wilhelm no topo
- Menu Admin: Visão Geral · Proprietários · Imóveis · Reservas
- Menu Proprietário: Dashboard · Meus Imóveis
- Ícones Lucide com texto em PT-BR
- Indicador de rota ativa com dourado

**4.3 Dashboard Proprietário (`proprietario/Dashboard.tsx`)**
- Card "Receita do Mês Atual" — soma `valor_liquido_proprietario` com `data_fim` no mês vigente
- Card "Previsão Meses Seguintes" — soma futuras
- Calendário mensal (`react-day-picker`):
  - Dias ocupados com fundo `#A3A38B`
  - Click no dia → Popover com detalhes da reserva (check-in, check-out, valor líquido)

**4.4 Admin — Gestão de Proprietários**
- Tabela com todos os proprietários
- Dialog "Novo Proprietário": nome, email, senha temporária → `supabase.auth.admin.createUser` via Edge Function

**4.5 Admin — Gestão de Imóveis**
- Tabela de imóveis com proprietário vinculado
- Dialog para criar/editar imóvel

**4.6 Admin — Gestão de Reservas**
- Formulário: selecionar imóvel (dropdown), data início/fim, valor bruto, valor líquido
- Tabela de reservas com filtro por imóvel/proprietário

---

### Fase 5 — Edge Function (criação de usuário pelo admin)

Como `supabase.auth.admin.createUser` exige a service role key (nunca exposta no cliente), precisamos de uma Edge Function:

```text
supabase/functions/create-user/index.ts
```
- Recebe `{ email, password, nome, role }` 
- Usa `SUPABASE_SERVICE_ROLE_KEY` para criar usuário no Auth
- Insere/atualiza `profiles` e `user_roles`
- Protegida por verificação de role admin no JWT

---

### Conexão Supabase

O primeiro passo ao iniciar a implementação será solicitar ao usuário que conecte o Supabase ao projeto via o botão de integração do Lovable, pois o banco externo foi escolhido.
