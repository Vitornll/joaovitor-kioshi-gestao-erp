-- ============================================================================
-- KIOSHI GESTÃO — Schema inicial (Supabase/Postgres)
-- Empresa: Kioshi Controle de Pragas
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type user_role as enum ('diretoria', 'supervisor', 'tecnico');
create type commercial_stage as enum ('prospeccao', 'proposta', 'contrato', 'cliente_spot', 'ex_cliente');
create type client_kind as enum ('pessoa_fisica', 'pessoa_juridica');
create type contract_recurrence as enum ('avulso', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');
create type contract_status as enum ('ativo', 'suspenso', 'encerrado');
create type service_order_status as enum ('pendente', 'confirmado', 'em_rota', 'em_execucao', 'concluido', 'cancelado');
create type quote_status as enum ('aguardando', 'aprovado', 'nao_aprovado', 'vencido');
create type charge_status as enum ('a_receber', 'recebido', 'vencido', 'cancelado');
create type product_category as enum ('quimico', 'epi', 'equipamento', 'outro');
create type movement_type as enum ('entrada', 'saida', 'transferencia_bolsa', 'retorno_central', 'uso_em_servico', 'descarte');
create type doc_kind as enum ('documento', 'treinamento', 'foto', 'outro');

-- ---------------------------------------------------------------------------
-- EMPRESA / CONFIGURAÇÕES
-- ---------------------------------------------------------------------------
create table company_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Kioshi Controle de Pragas',
  cnpj text,
  logo_url text,
  primary_color text default '#C8102E',
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PERFIS DE USUÁRIO (ligado a auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'tecnico',
  phone text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- CLIENTES
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  kind client_kind not null default 'pessoa_fisica',
  name text not null,
  cpf text,
  cnpj text,
  contact_name text,
  phone text,
  email text,
  commercial_stage commercial_stage not null default 'prospeccao',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_cpf_idx on clients(cpf) where cpf is not null;
create unique index clients_cnpj_idx on clients(cnpj) where cnpj is not null;

create table client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  label text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  zip text,
  reference text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SERVIÇOS / CONTRATOS
-- ---------------------------------------------------------------------------
create table service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_duration_minutes int default 60,
  default_price numeric(12,2),
  active boolean not null default true
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_type_id uuid references service_types(id),
  recurrence contract_recurrence not null default 'avulso',
  start_date date not null default current_date,
  end_date date,
  value numeric(12,2),
  status contract_status not null default 'ativo',
  notes text,
  created_at timestamptz not null default now()
);

create table service_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  address_id uuid references client_addresses(id),
  contract_id uuid references contracts(id),
  service_type_id uuid references service_types(id),
  scheduled_at timestamptz not null,
  duration_minutes int default 60,
  status service_order_status not null default 'pendente',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index service_orders_scheduled_idx on service_orders(scheduled_at);

create table service_order_assignees (
  service_order_id uuid not null references service_orders(id) on delete cascade,
  employee_id uuid not null references profiles(id) on delete cascade,
  primary key (service_order_id, employee_id)
);

create table service_order_execution (
  service_order_id uuid primary key references service_orders(id) on delete cascade,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  ppe_confirmed boolean default false,
  signature_url text,
  photos jsonb not null default '[]'::jsonb,
  products_used jsonb not null default '[]'::jsonb,
  execution_notes text,
  report_pdf_url text
);

-- ---------------------------------------------------------------------------
-- RH / EQUIPE
-- ---------------------------------------------------------------------------
create table employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  full_name text not null,
  cargo text,
  admission_date date,
  birth_date date,
  cnh_number text,
  cnh_validity date,
  aso_validity date,
  free_for_any_contract boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table employee_contracts (
  employee_id uuid not null references employees(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  primary key (employee_id, contract_id)
);

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  kind doc_kind not null default 'documento',
  name text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FROTA
-- ---------------------------------------------------------------------------
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  model text,
  odometer_km numeric(10,1) default 0,
  next_maintenance_km numeric(10,1),
  next_maintenance_date date,
  licensing_due_date date,
  status text default 'disponivel',
  created_at timestamptz not null default now()
);

create table vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  name text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ESTOQUE / PRODUTOS QUÍMICOS
-- ---------------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category product_category not null default 'quimico',
  unit text not null default 'un',
  min_stock numeric(12,3) not null default 0,
  active boolean not null default true
);

create table product_lots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  lot_number text not null,
  expiry_date date,
  quantity_central numeric(12,3) not null default 0,
  created_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  lot_id uuid references product_lots(id),
  employee_id uuid references employees(id),
  service_order_id uuid references service_orders(id),
  movement_type movement_type not null,
  quantity numeric(12,3) not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CONFORMIDADE
-- ---------------------------------------------------------------------------
create table compliance_licenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_type text,
  issue_date date,
  expiry_date date,
  document_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CRM / ORÇAMENTOS
-- ---------------------------------------------------------------------------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  client_id uuid references clients(id),
  responsible_profile_id uuid references profiles(id),
  city text,
  state text,
  issue_date date not null default current_date,
  validity_date date,
  service_description text,
  value numeric(12,2),
  status quote_status not null default 'aguardando',
  pdf_url text,
  created_at timestamptz not null default now()
);

create table sales_goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  period text not null, -- 'YYYY-MM'
  goal_value numeric(12,2) not null default 0,
  commission_rate numeric(5,2) not null default 0
);

-- ---------------------------------------------------------------------------
-- FINANCEIRO
-- ---------------------------------------------------------------------------
create table charges (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid references service_orders(id),
  client_id uuid references clients(id),
  description text,
  value numeric(12,2) not null default 0,
  payment_method text,
  due_date date,
  received_date date,
  status charge_status not null default 'a_receber',
  reference text,
  attachment_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table company_settings enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_addresses enable row level security;
alter table service_types enable row level security;
alter table contracts enable row level security;
alter table service_orders enable row level security;
alter table service_order_assignees enable row level security;
alter table service_order_execution enable row level security;
alter table employees enable row level security;
alter table employee_contracts enable row level security;
alter table employee_documents enable row level security;
alter table vehicles enable row level security;
alter table vehicle_documents enable row level security;
alter table products enable row level security;
alter table product_lots enable row level security;
alter table stock_movements enable row level security;
alter table compliance_licenses enable row level security;
alter table audit_log enable row level security;
alter table quotes enable row level security;
alter table sales_goals enable row level security;
alter table charges enable row level security;

-- Perfis: todo autenticado pode ler; cada um atualiza o próprio; staff (diretoria) gerencia todos
create policy profiles_select on profiles for select using (auth.role() = 'authenticated');
create policy profiles_update_self on profiles for update using (id = auth.uid());
create policy profiles_staff_all on profiles for all using (current_role_name() = 'diretoria');

-- company_settings: leitura geral autenticada; escrita só diretoria
create policy company_settings_select on company_settings for select using (auth.role() = 'authenticated');
create policy company_settings_write on company_settings for all using (current_role_name() = 'diretoria');

-- Tabelas de staff (diretoria + supervisor têm acesso amplo)
create policy staff_full_clients on clients for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_addresses on client_addresses for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_service_types on service_types for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_contracts on contracts for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_employees on employees for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_employee_contracts on employee_contracts for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_employee_documents on employee_documents for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_vehicles on vehicles for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_vehicle_documents on vehicle_documents for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_products on products for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_product_lots on product_lots for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_compliance on compliance_licenses for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_audit on audit_log for select using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_quotes on quotes for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_goals on sales_goals for all using (current_role_name() in ('diretoria','supervisor'));
create policy staff_full_charges on charges for all using (current_role_name() in ('diretoria','supervisor'));

-- service_orders: staff vê tudo; técnico vê/edita apenas as próprias designações
create policy staff_full_service_orders on service_orders for all using (current_role_name() in ('diretoria','supervisor'));
create policy tecnico_select_own_orders on service_orders for select using (
  current_role_name() = 'tecnico' and exists (
    select 1 from service_order_assignees soa where soa.service_order_id = service_orders.id and soa.employee_id = auth.uid()
  )
);
create policy tecnico_update_own_orders on service_orders for update using (
  current_role_name() = 'tecnico' and exists (
    select 1 from service_order_assignees soa where soa.service_order_id = service_orders.id and soa.employee_id = auth.uid()
  )
);

create policy staff_full_assignees on service_order_assignees for all using (current_role_name() in ('diretoria','supervisor'));
create policy tecnico_select_own_assignment on service_order_assignees for select using (employee_id = auth.uid());

create policy staff_full_execution on service_order_execution for all using (current_role_name() in ('diretoria','supervisor'));
create policy tecnico_manage_own_execution on service_order_execution for all using (
  exists (
    select 1 from service_order_assignees soa where soa.service_order_id = service_order_execution.service_order_id and soa.employee_id = auth.uid()
  )
);

create policy staff_full_stock_movements on stock_movements for all using (current_role_name() in ('diretoria','supervisor'));
create policy tecnico_select_own_movements on stock_movements for select using (
  employee_id in (select id from employees where profile_id = auth.uid())
);
create policy tecnico_insert_own_movements on stock_movements for insert with check (
  employee_id in (select id from employees where profile_id = auth.uid())
);
