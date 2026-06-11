-- ============================================================
-- Agenda Barbearia - Schema inicial
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

create extension if not exists btree_gist;

-- ------------------------------------------------------------
-- Perfis dos usuarios do painel admin (dono e barbeiros)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'barber' check (role in ('owner', 'barber')),
  created_at timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um usuario se cadastra.
-- O primeiro usuario vira 'owner', os demais 'barber'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when not exists (select 1 from public.profiles) then 'owner' else 'barber' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Funcao auxiliar: o usuario logado e admin (tem perfil)?
create or replace function public.is_admin()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- Funcao auxiliar: o usuario logado e o dono?
create or replace function public.is_owner()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

-- ------------------------------------------------------------
-- Profissionais
-- ------------------------------------------------------------
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  active boolean not null default true,
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Servicos
-- ------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Quais servicos cada profissional faz
create table public.professional_services (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (professional_id, service_id)
);

-- ------------------------------------------------------------
-- Grade semanal de horarios de cada profissional
-- weekday: 0 = domingo ... 6 = sabado
-- ------------------------------------------------------------
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  check (start_time < end_time)
);

create index working_hours_professional_idx
  on public.working_hours (professional_id, weekday);

-- ------------------------------------------------------------
-- Agendamentos
-- ------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete restrict,
  customer_first_name text not null,
  customer_last_name text not null,
  customer_whatsapp text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'done')),
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

-- Impede dois agendamentos confirmados no mesmo horario do mesmo profissional
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    tsrange((date + start_time), (date + end_time)) with &&
  )
  where (status = 'confirmed');

create index appointments_professional_date_idx
  on public.appointments (professional_id, date);

create index appointments_whatsapp_idx
  on public.appointments (customer_whatsapp);

-- Servicos escolhidos em cada agendamento
create table public.appointment_services (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  primary key (appointment_id, service_id)
);

-- ------------------------------------------------------------
-- Row Level Security
-- Leitura publica: catalogo (profissionais, servicos, grade).
-- Agendamentos: somente admins logados; o site/automacao cria
-- agendamentos pela API do sistema (service role).
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.professional_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;

-- profiles
create policy "ler o proprio perfil" on public.profiles
  for select using (id = auth.uid());
create policy "dono le todos os perfis" on public.profiles
  for select using (public.is_owner());
create policy "dono gerencia perfis" on public.profiles
  for update using (public.is_owner());

-- professionals
create policy "leitura publica de profissionais ativos" on public.professionals
  for select using (active = true);
create policy "admin le todos os profissionais" on public.professionals
  for select using (public.is_admin());
create policy "dono gerencia profissionais" on public.professionals
  for all using (public.is_owner());

-- services
create policy "leitura publica de servicos ativos" on public.services
  for select using (active = true);
create policy "admin le todos os servicos" on public.services
  for select using (public.is_admin());
create policy "dono gerencia servicos" on public.services
  for all using (public.is_owner());

-- professional_services
create policy "leitura publica de vinculos" on public.professional_services
  for select using (true);
create policy "dono gerencia vinculos" on public.professional_services
  for all using (public.is_owner());

-- working_hours
create policy "leitura publica da grade" on public.working_hours
  for select using (true);
create policy "dono gerencia grade" on public.working_hours
  for all using (public.is_owner());
create policy "barbeiro gerencia a propria grade" on public.working_hours
  for all using (
    exists (
      select 1 from public.professionals p
      where p.id = working_hours.professional_id
        and p.profile_id = auth.uid()
    )
  );

-- appointments (sem acesso publico; criacao via API do sistema)
create policy "admin le agendamentos" on public.appointments
  for select using (public.is_admin());
create policy "dono gerencia agendamentos" on public.appointments
  for all using (public.is_owner());
create policy "barbeiro atualiza os proprios agendamentos" on public.appointments
  for update using (
    exists (
      select 1 from public.professionals p
      where p.id = appointments.professional_id
        and p.profile_id = auth.uid()
    )
  );

-- appointment_services
create policy "admin le servicos dos agendamentos" on public.appointment_services
  for select using (public.is_admin());
create policy "dono gerencia servicos dos agendamentos" on public.appointment_services
  for all using (public.is_owner());

-- ------------------------------------------------------------
-- Storage: bucket publico para fotos
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "leitura publica de fotos" on storage.objects
  for select using (bucket_id = 'photos');
create policy "admin envia fotos" on storage.objects
  for insert with check (bucket_id = 'photos' and public.is_admin());
create policy "admin atualiza fotos" on storage.objects
  for update using (bucket_id = 'photos' and public.is_admin());
create policy "admin remove fotos" on storage.objects
  for delete using (bucket_id = 'photos' and public.is_admin());
