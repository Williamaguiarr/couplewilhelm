
-- Enum de roles
create type public.app_role as enum ('admin', 'proprietario');

-- Tabela de perfis (espelha auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  nome text,
  created_at timestamptz default now()
);

-- Tabela de roles separada (segurança)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

-- Tabela de imóveis
create table public.imoveis (
  id uuid primary key default gen_random_uuid(),
  nome_imovel text not null,
  endereco text,
  proprietario_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Tabela de reservas
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid references public.imoveis(id) on delete cascade not null,
  data_inicio date not null,
  data_fim date not null,
  valor_bruto numeric(10,2),
  valor_liquido_proprietario numeric(10,2),
  observacoes text,
  created_at timestamptz default now()
);

-- Habilitar RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.imoveis enable row level security;
alter table public.reservas enable row level security;

-- Função security definer para verificar role (evita recursão RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Trigger para criar profile automaticamente ao criar usuário
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================
-- RLS POLICIES
-- =====================

-- PROFILES
create policy "Usuarios podem ver proprio perfil"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "Usuarios podem atualizar proprio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admin pode inserir perfis"
  on public.profiles for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES
create policy "Admin e proprio usuario podem ver roles"
  on public.user_roles for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or user_id = auth.uid());

create policy "Admin pode inserir roles"
  on public.user_roles for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admin pode deletar roles"
  on public.user_roles for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- IMOVEIS
create policy "Admin pode fazer tudo em imoveis"
  on public.imoveis for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Proprietario pode ver proprios imoveis"
  on public.imoveis for select
  to authenticated
  using (proprietario_id = auth.uid());

-- RESERVAS
create policy "Admin pode fazer tudo em reservas"
  on public.reservas for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Proprietario pode ver reservas dos proprios imoveis"
  on public.reservas for select
  to authenticated
  using (
    exists (
      select 1 from public.imoveis
      where imoveis.id = reservas.imovel_id
        and imoveis.proprietario_id = auth.uid()
    )
  );
