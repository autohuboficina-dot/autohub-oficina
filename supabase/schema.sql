-- AutoHub Oficina - Supabase initial schema
-- This file models the SaaS data layer only. The frontend is not connected yet.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'os_status') then
    create type os_status as enum (
      'ABERTA',
      'EM_DIAGNOSTICO',
      'AGUARDANDO_COTACAO',
      'COTACAO_RECEBIDA',
      'ORCAMENTO_ENVIADO',
      'AGUARDANDO_APROVACAO',
      'APROVADA',
      'APROVADA_PARCIAL',
      'AGUARDANDO_PECA',
      'EM_EXECUCAO',
      'FINALIZADA',
      'ENTREGUE',
      'CANCELADA'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'orcamento_status') then
    create type orcamento_status as enum (
      'RASCUNHO',
      'APROVADO',
      'PENDENTE',
      'PRE_APROVADO',
      'PRE_APROVADO_PARCIAL',
      'CONFIRMADO_OFICINA',
      'RECUSADO',
      'REVISAO'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'foto_visibilidade') then
    create type foto_visibilidade as enum (
      'CLIENTE',
      'FORNECEDOR',
      'AMBOS',
      'INTERNO'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'financeiro_tipo') then
    create type financeiro_tipo as enum (
      'ENTRADA',
      'SAIDA'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'financeiro_status') then
    create type financeiro_status as enum (
      'PENDENTE',
      'PAGO',
      'CANCELADO'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'cotacao_status') then
    create type cotacao_status as enum (
      'COTACAO_ENVIADA',
      'RESPOSTA_RECEBIDA',
      'FORNECEDOR_ESCOLHIDO',
      'COTACAO_PARCIAL',
      'COTACAO_CONCLUIDA',
      'AGUARDANDO_APROVACAO_CLIENTE',
      'APROVADA_PELO_CLIENTE',
      'NAO_APROVADA_PELO_CLIENTE',
      'COMPRA_CONFIRMADA_FORNECEDOR',
      'CANCELADA'
    );
  end if;
end $$;

alter type orcamento_status add value if not exists 'RASCUNHO';
alter type orcamento_status add value if not exists 'APROVADO';

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists oficinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  whatsapp text,
  email text,
  endereco text,
  cidade text,
  logo_url text,
  chave_pix text,
  texto_padrao_orcamento text,
  politica_entrada_sinal text,
  regras_pagamento jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oficinas_email_check check (email is null or email = '' or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  email text not null,
  perfil text not null,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_perfil_check check (perfil in ('admin', 'mecanico', 'atendimento', 'compras', 'financeiro')),
  constraint usuarios_status_check check (status in ('ativo', 'inativo')),
  constraint usuarios_email_check check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  constraint usuarios_oficina_email_unique unique (oficina_id, email)
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  tipo text not null default 'Pessoa fisica',
  nome text not null,
  telefone text,
  documento text,
  email text,
  cidade text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_tipo_check check (tipo in ('Pessoa fisica', 'Empresa', 'Frota')),
  constraint clientes_email_check check (email is null or email = '' or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create table if not exists veiculos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  marca text,
  modelo text not null,
  ano text,
  motor text,
  combustivel text,
  placa text,
  chassi_vin text,
  km_atual numeric(12, 1),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  nome text not null,
  whatsapp text,
  categoria text not null default 'Outros',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fornecedores_categoria_check check (
    categoria in ('Pecas', 'Pneus', 'Oleo e lubrificantes', 'Eletrica', 'Funilaria', 'Servicos terceirizados', 'Outros')
  )
);

create table if not exists ordens_servico (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete restrict,
  veiculo_id uuid not null references veiculos(id) on delete restrict,
  codigo text not null,
  version integer not null default 1,
  status os_status not null default 'ABERTA',
  problema_relatado text,
  observacao text,
  diagnostico jsonb not null default '{}'::jsonb,
  checklist_inicial jsonb not null default '[]'::jsonb,
  status_orcamento orcamento_status not null default 'PENDENTE',
  exige_entrada boolean not null default false,
  tipo_entrada text not null default 'valor',
  valor_entrada numeric(12, 2) not null default 0,
  percentual_entrada numeric(5, 2) not null default 0,
  entrada_calculada numeric(12, 2) not null default 0,
  saldo_restante numeric(12, 2) not null default 0,
  status_entrada text not null default 'nao_exige',
  data_pagamento_entrada timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ordens_servico_codigo_unique unique (oficina_id, codigo),
  constraint ordens_servico_tipo_entrada_check check (tipo_entrada in ('valor', 'percentual')),
  constraint ordens_servico_status_entrada_check check (status_entrada in ('nao_exige', 'pendente', 'paga')),
  constraint ordens_servico_version_check check (version > 0),
  constraint ordens_servico_valores_check check (
    valor_entrada >= 0
    and percentual_entrada >= 0
    and percentual_entrada <= 100
    and entrada_calculada >= 0
    and saldo_restante >= 0
  )
);

create table if not exists os_pecas (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  ordem_servico_id uuid not null references ordens_servico(id) on delete cascade,
  cotacao_item_id uuid,
  nome text not null,
  quantidade numeric(12, 2) not null default 1,
  valor_unitario numeric(12, 2) not null default 0,
  valor_total numeric(12, 2) generated always as (quantidade * valor_unitario) stored,
  origem_checklist text,
  fornecedor_escolhido text,
  marca_escolhida text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_pecas_quantidade_check check (quantidade > 0),
  constraint os_pecas_valor_check check (valor_unitario >= 0)
);

create table if not exists os_servicos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  ordem_servico_id uuid not null references ordens_servico(id) on delete cascade,
  servico text not null,
  descricao text,
  valor numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_servicos_valor_check check (valor >= 0)
);

create table if not exists os_fotos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  ordem_servico_id uuid not null references ordens_servico(id) on delete cascade,
  titulo text not null,
  tipo text not null,
  visibilidade foto_visibilidade not null default 'INTERNO',
  storage_path text not null,
  mime_type text,
  tamanho_bytes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_fotos_tipo_check check (tipo in ('problema', 'peca', 'tecnico', 'antes', 'depois')),
  constraint os_fotos_tamanho_check check (tamanho_bytes is null or tamanho_bytes > 0)
);

create table if not exists cotacoes (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  ordem_servico_id uuid not null references ordens_servico(id) on delete cascade,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  status cotacao_status not null default 'COTACAO_ENVIADA',
  observacao text,
  enviada_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cotacao_itens (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  cotacao_id uuid not null references cotacoes(id) on delete cascade,
  nome_peca text not null,
  quantidade numeric(12, 2) not null default 1,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cotacao_itens_quantidade_check check (quantidade > 0)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'os_pecas_cotacao_item_fk'
  ) then
    alter table os_pecas
      add constraint os_pecas_cotacao_item_fk
      foreign key (cotacao_item_id) references cotacao_itens(id) on delete set null;
  end if;
end $$;

create table if not exists respostas_fornecedor (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  cotacao_id uuid not null references cotacoes(id) on delete cascade,
  cotacao_item_id uuid references cotacao_itens(id) on delete cascade,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  preco numeric(12, 2) not null default 0,
  marca text,
  observacao text,
  data_resposta timestamptz not null default now(),
  escolhido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint respostas_fornecedor_preco_check check (preco >= 0)
);

create table if not exists orcamentos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  ordem_servico_id uuid not null references ordens_servico(id) on delete cascade,
  public_token uuid not null default gen_random_uuid(),
  public_expires_at timestamptz,
  aprovado_em timestamptz,
  aprovado_ip text,
  version integer not null default 1,
  status orcamento_status not null default 'PENDENTE',
  total_pecas numeric(12, 2) not null default 0,
  total_mao_de_obra numeric(12, 2) not null default 0,
  desconto_tipo text not null default 'valor',
  desconto_valor numeric(12, 2) not null default 0,
  desconto_aplicado numeric(12, 2) not null default 0,
  forma_pagamento text,
  total_final numeric(12, 2) not null default 0,
  itens_aprovados jsonb not null default '[]'::jsonb,
  observacao_aprovacao text,
  data_decisao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orcamentos_desconto_tipo_check check (desconto_tipo in ('valor', 'percentual')),
  constraint orcamentos_version_check check (version > 0),
  constraint orcamentos_valores_check check (
    total_pecas >= 0
    and total_mao_de_obra >= 0
    and desconto_valor >= 0
    and desconto_aplicado >= 0
    and total_final >= 0
  )
);

alter table orcamentos add column if not exists public_token uuid not null default gen_random_uuid();
alter table orcamentos add column if not exists public_expires_at timestamptz;
alter table orcamentos add column if not exists aprovado_em timestamptz;
alter table orcamentos add column if not exists aprovado_ip text;

create table if not exists orcamento_revisoes (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  ordem_servico_id uuid not null references ordens_servico(id) on delete cascade,
  orcamento_id uuid references orcamentos(id) on delete set null,
  numero_revisao integer not null,
  motivo text,
  dados_anteriores jsonb not null default '{}'::jsonb,
  dados_novos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orcamento_revisoes_numero_check check (numero_revisao > 0),
  constraint orcamento_revisoes_unique unique (
    oficina_id,
    ordem_servico_id,
    numero_revisao
  )
);

create table if not exists financeiro (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  ordem_servico_id uuid references ordens_servico(id) on delete set null,
  cotacao_id uuid references cotacoes(id) on delete set null,
  tipo financeiro_tipo not null,
  descricao text not null,
  valor numeric(12, 2) not null,
  data_lancamento date not null default current_date,
  status financeiro_status not null default 'PENDENTE',
  categoria text not null default 'Outros',
  origem text not null default 'Manual',
  origem_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financeiro_valor_check check (valor >= 0),
  constraint financeiro_origem_check check (origem in ('OS', 'Compra', 'Manual')),
  constraint financeiro_categoria_check check (categoria in ('Pecas', 'Mao de obra', 'Despesa fixa', 'Taxa cartao', 'Outros'))
);

create table if not exists timeline_os (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  ordem_servico_id uuid not null references ordens_servico(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  tipo text not null,
  titulo text not null,
  descricao text,
  status_anterior os_status,
  status_novo os_status,
  data_evento timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists usuarios_oficina_idx on usuarios(oficina_id);
create index if not exists clientes_oficina_nome_idx on clientes(oficina_id, nome);
create index if not exists veiculos_oficina_cliente_idx on veiculos(oficina_id, cliente_id);
create index if not exists veiculos_oficina_placa_idx on veiculos(oficina_id, placa);
create unique index if not exists veiculos_oficina_placa_unique_idx
  on veiculos(oficina_id, placa)
  where placa is not null and placa <> '';
create index if not exists fornecedores_oficina_nome_idx on fornecedores(oficina_id, nome);
create index if not exists ordens_servico_oficina_status_idx on ordens_servico(oficina_id, status);
create index if not exists ordens_servico_cliente_idx on ordens_servico(cliente_id);
create index if not exists ordens_servico_veiculo_idx on ordens_servico(veiculo_id);
create index if not exists os_pecas_ordem_idx on os_pecas(ordem_servico_id);
create index if not exists os_servicos_ordem_idx on os_servicos(ordem_servico_id);
create index if not exists os_fotos_ordem_idx on os_fotos(ordem_servico_id);
create index if not exists cotacoes_ordem_idx on cotacoes(ordem_servico_id);
create index if not exists cotacoes_fornecedor_idx on cotacoes(fornecedor_id);
create index if not exists cotacao_itens_cotacao_idx on cotacao_itens(cotacao_id);
create index if not exists respostas_fornecedor_cotacao_idx on respostas_fornecedor(cotacao_id);
create index if not exists respostas_fornecedor_item_idx on respostas_fornecedor(cotacao_item_id);
create index if not exists orcamentos_ordem_idx on orcamentos(ordem_servico_id);
create unique index if not exists orcamentos_public_token_unique_idx on orcamentos(public_token);
create index if not exists orcamento_revisoes_ordem_idx on orcamento_revisoes(ordem_servico_id);
create index if not exists financeiro_oficina_data_idx on financeiro(oficina_id, data_lancamento);
create index if not exists financeiro_ordem_idx on financeiro(ordem_servico_id);
create index if not exists timeline_os_ordem_data_idx on timeline_os(ordem_servico_id, data_evento desc);

create or replace function public_get_orcamento(p_public_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'public_token', o.public_token,
    'status', o.status,
    'public_expires_at', o.public_expires_at,
    'aprovado_em', o.aprovado_em,
    'os_status', os.status,
    'cliente', jsonb_build_object(
      'nome', c.nome,
      'telefone', c.telefone
    ),
    'veiculo', jsonb_build_object(
      'marca', v.marca,
      'modelo', v.modelo,
      'ano', v.ano,
      'placa', v.placa
    ),
    'ordem_servico', jsonb_build_object(
      'problema_relatado', os.problema_relatado
    ),
    'pecas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'nome', p.nome,
          'quantidade', p.quantidade,
          'valor_unitario', p.valor_unitario,
          'valor_total', p.valor_total
        )
        order by p.created_at
      )
      from os_pecas p
      where p.oficina_id = o.oficina_id
        and p.ordem_servico_id = o.ordem_servico_id
    ), '[]'::jsonb),
    'servicos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'descricao', coalesce(nullif(s.servico, ''), s.descricao),
          'valor', s.valor
        )
        order by s.created_at
      )
      from os_servicos s
      where s.oficina_id = o.oficina_id
        and s.ordem_servico_id = o.ordem_servico_id
    ), '[]'::jsonb),
    'totais', jsonb_build_object(
      'total_pecas', o.total_pecas,
      'total_servicos', o.total_mao_de_obra,
      'total_final', o.total_final
    )
  )
  into result
  from orcamentos o
  join ordens_servico os
    on os.id = o.ordem_servico_id
    and os.oficina_id = o.oficina_id
  left join clientes c
    on c.id = os.cliente_id
    and c.oficina_id = o.oficina_id
  left join veiculos v
    on v.id = os.veiculo_id
    and v.oficina_id = o.oficina_id
  where o.public_token = p_public_token
    and (o.public_expires_at is null or o.public_expires_at > now())
  limit 1;

  return result;
end;
$$;

create or replace function public_approve_orcamento(
  p_public_token uuid,
  p_aprovado_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_budget record;
begin
  update orcamentos
  set
    status = 'APROVADO',
    aprovado_em = now(),
    aprovado_ip = p_aprovado_ip,
    updated_at = now()
  where public_token = p_public_token
    and status = 'RASCUNHO'
    and (public_expires_at is null or public_expires_at > now())
  returning id, oficina_id, ordem_servico_id, status, aprovado_em
  into updated_budget;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Orcamento indisponivel, expirado ou ja aprovado.'
    );
  end if;

  update ordens_servico
  set
    status = 'APROVADA',
    version = version + 1,
    updated_at = now()
  where id = updated_budget.ordem_servico_id
    and oficina_id = updated_budget.oficina_id;

  return jsonb_build_object(
    'success', true,
    'id', updated_budget.id,
    'ordem_servico_id', updated_budget.ordem_servico_id,
    'status', updated_budget.status,
    'os_status', 'APROVADA',
    'aprovado_em', updated_budget.aprovado_em
  );
end;
$$;

grant execute on function public_get_orcamento(uuid) to anon, authenticated;
grant execute on function public_approve_orcamento(uuid, text) to anon, authenticated;

drop trigger if exists set_oficinas_updated_at on oficinas;
create trigger set_oficinas_updated_at
before update on oficinas
for each row execute function set_updated_at();

drop trigger if exists set_usuarios_updated_at on usuarios;
create trigger set_usuarios_updated_at
before update on usuarios
for each row execute function set_updated_at();

drop trigger if exists set_clientes_updated_at on clientes;
create trigger set_clientes_updated_at
before update on clientes
for each row execute function set_updated_at();

drop trigger if exists set_veiculos_updated_at on veiculos;
create trigger set_veiculos_updated_at
before update on veiculos
for each row execute function set_updated_at();

drop trigger if exists set_fornecedores_updated_at on fornecedores;
create trigger set_fornecedores_updated_at
before update on fornecedores
for each row execute function set_updated_at();

drop trigger if exists set_ordens_servico_updated_at on ordens_servico;
create trigger set_ordens_servico_updated_at
before update on ordens_servico
for each row execute function set_updated_at();

drop trigger if exists set_os_pecas_updated_at on os_pecas;
create trigger set_os_pecas_updated_at
before update on os_pecas
for each row execute function set_updated_at();

drop trigger if exists set_os_servicos_updated_at on os_servicos;
create trigger set_os_servicos_updated_at
before update on os_servicos
for each row execute function set_updated_at();

drop trigger if exists set_os_fotos_updated_at on os_fotos;
create trigger set_os_fotos_updated_at
before update on os_fotos
for each row execute function set_updated_at();

drop trigger if exists set_cotacoes_updated_at on cotacoes;
create trigger set_cotacoes_updated_at
before update on cotacoes
for each row execute function set_updated_at();

drop trigger if exists set_cotacao_itens_updated_at on cotacao_itens;
create trigger set_cotacao_itens_updated_at
before update on cotacao_itens
for each row execute function set_updated_at();

drop trigger if exists set_respostas_fornecedor_updated_at on respostas_fornecedor;
create trigger set_respostas_fornecedor_updated_at
before update on respostas_fornecedor
for each row execute function set_updated_at();

drop trigger if exists set_orcamentos_updated_at on orcamentos;
create trigger set_orcamentos_updated_at
before update on orcamentos
for each row execute function set_updated_at();

drop trigger if exists set_orcamento_revisoes_updated_at on orcamento_revisoes;
create trigger set_orcamento_revisoes_updated_at
before update on orcamento_revisoes
for each row execute function set_updated_at();

drop trigger if exists set_financeiro_updated_at on financeiro;
create trigger set_financeiro_updated_at
before update on financeiro
for each row execute function set_updated_at();

drop trigger if exists set_timeline_os_updated_at on timeline_os;
create trigger set_timeline_os_updated_at
before update on timeline_os
for each row execute function set_updated_at();

alter table oficinas enable row level security;
alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table veiculos enable row level security;
alter table fornecedores enable row level security;
alter table ordens_servico enable row level security;
alter table os_pecas enable row level security;
alter table os_servicos enable row level security;
alter table os_fotos enable row level security;
alter table cotacoes enable row level security;
alter table cotacao_itens enable row level security;
alter table respostas_fornecedor enable row level security;
alter table orcamentos enable row level security;
alter table orcamento_revisoes enable row level security;
alter table financeiro enable row level security;
alter table timeline_os enable row level security;

comment on table oficinas is 'RLS enabled. Add tenant membership policies after auth and user onboarding are connected.';
comment on table usuarios is 'RLS enabled. Add policies mapping auth.uid() to usuarios.auth_user_id and oficina_id.';
comment on table clientes is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
comment on table veiculos is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
comment on table fornecedores is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
comment on table ordens_servico is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
comment on table os_pecas is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
comment on table os_servicos is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
comment on table os_fotos is 'RLS enabled. Add oficina_id scoped policies and storage bucket policies before frontend integration.';
comment on table cotacoes is 'RLS enabled. Add oficina_id scoped policies and public supplier access strategy later.';
comment on table cotacao_itens is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
comment on table respostas_fornecedor is 'RLS enabled. Add oficina_id scoped policies and signed supplier access later.';
comment on table orcamentos is 'RLS enabled. Oficina access must use tenant policies. Public customer access must use public_token RPC functions, not table listing.';
comment on table orcamento_revisoes is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
comment on table financeiro is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
comment on table timeline_os is 'RLS enabled. Add oficina_id scoped policies before frontend Supabase integration.';
