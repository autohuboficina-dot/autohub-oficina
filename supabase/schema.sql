-- AutoHub Oficina - Schema versionado
-- Estado real do banco em producao
-- Ultima sincronizacao: 2026-05-15

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

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
      'SELECIONADA',
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

alter type os_status add value if not exists 'ABERTA';
alter type os_status add value if not exists 'EM_DIAGNOSTICO';
alter type os_status add value if not exists 'AGUARDANDO_COTACAO';
alter type os_status add value if not exists 'COTACAO_RECEBIDA';
alter type os_status add value if not exists 'ORCAMENTO_ENVIADO';
alter type os_status add value if not exists 'AGUARDANDO_APROVACAO';
alter type os_status add value if not exists 'APROVADA';
alter type os_status add value if not exists 'APROVADA_PARCIAL';
alter type os_status add value if not exists 'AGUARDANDO_PECA';
alter type os_status add value if not exists 'EM_EXECUCAO';
alter type os_status add value if not exists 'FINALIZADA';
alter type os_status add value if not exists 'ENTREGUE';
alter type os_status add value if not exists 'CANCELADA';

alter type orcamento_status add value if not exists 'RASCUNHO';
alter type orcamento_status add value if not exists 'APROVADO';
alter type orcamento_status add value if not exists 'PENDENTE';
alter type orcamento_status add value if not exists 'PRE_APROVADO';
alter type orcamento_status add value if not exists 'PRE_APROVADO_PARCIAL';
alter type orcamento_status add value if not exists 'CONFIRMADO_OFICINA';
alter type orcamento_status add value if not exists 'RECUSADO';
alter type orcamento_status add value if not exists 'REVISAO';

alter type foto_visibilidade add value if not exists 'CLIENTE';
alter type foto_visibilidade add value if not exists 'FORNECEDOR';
alter type foto_visibilidade add value if not exists 'AMBOS';
alter type foto_visibilidade add value if not exists 'INTERNO';

alter type financeiro_tipo add value if not exists 'ENTRADA';
alter type financeiro_tipo add value if not exists 'SAIDA';

alter type financeiro_status add value if not exists 'PENDENTE';
alter type financeiro_status add value if not exists 'PAGO';
alter type financeiro_status add value if not exists 'CANCELADO';

alter type cotacao_status add value if not exists 'COTACAO_ENVIADA';
alter type cotacao_status add value if not exists 'RESPOSTA_RECEBIDA';
alter type cotacao_status add value if not exists 'SELECIONADA';
alter type cotacao_status add value if not exists 'FORNECEDOR_ESCOLHIDO';
alter type cotacao_status add value if not exists 'COTACAO_PARCIAL';
alter type cotacao_status add value if not exists 'COTACAO_CONCLUIDA';
alter type cotacao_status add value if not exists 'AGUARDANDO_APROVACAO_CLIENTE';
alter type cotacao_status add value if not exists 'APROVADA_PELO_CLIENTE';
alter type cotacao_status add value if not exists 'NAO_APROVADA_PELO_CLIENTE';
alter type cotacao_status add value if not exists 'COMPRA_CONFIRMADA_FORNECEDOR';
alter type cotacao_status add value if not exists 'CANCELADA';

-- ============================================================================
-- TABELAS PRINCIPAIS
-- ============================================================================

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
  markup_pecas numeric(5, 2) not null default 0,
  regras_pagamento jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oficinas_email_check check (email is null or email = '' or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  constraint oficinas_markup_pecas_check check (markup_pecas >= 0)
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
  estado text,
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
  tipo_veiculo text not null default 'Carro',
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
  updated_at timestamptz not null default now(),
  constraint veiculos_tipo_veiculo_check check (tipo_veiculo in ('Carro', 'Moto', 'Caminhao', 'Caminhão', 'Van', 'Outro'))
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
  recibo_token uuid,
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
  constraint orcamento_revisoes_unique unique (oficina_id, ordem_servico_id, numero_revisao)
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
  tipo_evento text,
  titulo text not null,
  descricao text,
  status_anterior os_status,
  status_novo os_status,
  data_evento timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- TABELAS NOVAS
-- ============================================================================

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  nome text not null,
  categoria text not null default 'Outros',
  unidade text not null default 'un',
  estoque_atual numeric(12, 2) not null default 0,
  estoque_minimo numeric(12, 2) not null default 0,
  valor_custo_medio numeric(12, 2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produtos_estoque_check check (estoque_atual >= 0 and estoque_minimo >= 0),
  constraint produtos_valor_check check (valor_custo_medio >= 0)
);

create table if not exists notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  chave_acesso text,
  numero text,
  serie text,
  data_emissao date,
  fornecedor_nome text,
  fornecedor_cnpj text,
  valor_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notas_fiscais_valor_total_check check (valor_total >= 0)
);

create table if not exists estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  produto_id uuid references produtos(id) on delete set null,
  produto_nome text not null,
  tipo text not null,
  quantidade numeric(12, 2) not null,
  valor_unitario numeric(12, 2) not null default 0,
  origem text not null default 'manual',
  nota_fiscal_id uuid references notas_fiscais(id) on delete set null,
  os_codigo text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estoque_movimentacoes_tipo_check check (tipo in ('entrada', 'saida', 'ajuste')),
  constraint estoque_movimentacoes_origem_check check (origem in ('xml_nf', 'manual', 'os', 'ajuste')),
  constraint estoque_movimentacoes_quantidade_check check (quantidade > 0),
  constraint estoque_movimentacoes_valor_check check (valor_unitario >= 0)
);

create table if not exists servicos_catalogo (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id) on delete cascade,
  nome text not null,
  valor_padrao numeric(12, 2) not null default 0,
  categoria text not null default 'Outros',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint servicos_catalogo_valor_check check (valor_padrao >= 0),
  constraint servicos_catalogo_categoria_check check (categoria in ('Mecanica', 'Mecânica', 'Eletrica', 'Elétrica', 'Funilaria', 'Suspensao', 'Suspensão', 'Freios', 'Revisao', 'Revisão', 'Outros'))
);

create table if not exists feedbacks (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid references oficinas(id) on delete set null,
  tipo text not null,
  descricao text not null,
  avaliacao integer not null default 0,
  oficina_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedbacks_tipo_check check (tipo in ('Sugestao de melhoria', 'Sugestão de melhoria', 'Reportar problema', 'Nova funcionalidade')),
  constraint feedbacks_avaliacao_check check (avaliacao >= 0 and avaliacao <= 5)
);

-- ============================================================================
-- INDICES
-- ============================================================================

create index if not exists usuarios_oficina_idx on usuarios(oficina_id);
create index if not exists usuarios_auth_user_idx on usuarios(auth_user_id);
create index if not exists clientes_oficina_nome_idx on clientes(oficina_id, nome);
create index if not exists veiculos_oficina_cliente_idx on veiculos(oficina_id, cliente_id);
create index if not exists veiculos_oficina_placa_idx on veiculos(oficina_id, placa);
create unique index if not exists veiculos_oficina_placa_unique_idx on veiculos(oficina_id, placa) where placa is not null and placa <> '';
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
create unique index if not exists respostas_fornecedor_item_escolhido_unique_idx on respostas_fornecedor(cotacao_item_id) where escolhido = true;
create index if not exists orcamentos_ordem_idx on orcamentos(ordem_servico_id);
create unique index if not exists orcamentos_public_token_unique_idx on orcamentos(public_token);
create unique index if not exists orcamentos_recibo_token_unique_idx on orcamentos(recibo_token) where recibo_token is not null;
create index if not exists orcamento_revisoes_ordem_idx on orcamento_revisoes(ordem_servico_id);
create index if not exists financeiro_oficina_data_idx on financeiro(oficina_id, data_lancamento);
create index if not exists financeiro_ordem_idx on financeiro(ordem_servico_id);
create index if not exists timeline_os_ordem_data_idx on timeline_os(ordem_servico_id, data_evento desc);
create index if not exists produtos_oficina_nome_idx on produtos(oficina_id, nome);
create index if not exists produtos_oficina_ativo_idx on produtos(oficina_id, ativo);
create index if not exists notas_fiscais_oficina_numero_idx on notas_fiscais(oficina_id, numero);
create index if not exists notas_fiscais_chave_acesso_idx on notas_fiscais(chave_acesso);
create index if not exists estoque_movimentacoes_oficina_produto_idx on estoque_movimentacoes(oficina_id, produto_id);
create index if not exists estoque_movimentacoes_oficina_created_idx on estoque_movimentacoes(oficina_id, created_at desc);
create index if not exists servicos_catalogo_oficina_nome_idx on servicos_catalogo(oficina_id, nome);
create index if not exists feedbacks_oficina_created_idx on feedbacks(oficina_id, created_at desc);

-- ============================================================================
-- FUNCAO DE UPDATED_AT E TRIGGERS
-- ============================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_oficinas_updated_at on oficinas;
create trigger set_oficinas_updated_at before update on oficinas for each row execute function set_updated_at();

drop trigger if exists set_usuarios_updated_at on usuarios;
create trigger set_usuarios_updated_at before update on usuarios for each row execute function set_updated_at();

drop trigger if exists set_clientes_updated_at on clientes;
create trigger set_clientes_updated_at before update on clientes for each row execute function set_updated_at();

drop trigger if exists set_veiculos_updated_at on veiculos;
create trigger set_veiculos_updated_at before update on veiculos for each row execute function set_updated_at();

drop trigger if exists set_fornecedores_updated_at on fornecedores;
create trigger set_fornecedores_updated_at before update on fornecedores for each row execute function set_updated_at();

drop trigger if exists set_ordens_servico_updated_at on ordens_servico;
create trigger set_ordens_servico_updated_at before update on ordens_servico for each row execute function set_updated_at();

drop trigger if exists set_os_pecas_updated_at on os_pecas;
create trigger set_os_pecas_updated_at before update on os_pecas for each row execute function set_updated_at();

drop trigger if exists set_os_servicos_updated_at on os_servicos;
create trigger set_os_servicos_updated_at before update on os_servicos for each row execute function set_updated_at();

drop trigger if exists set_os_fotos_updated_at on os_fotos;
create trigger set_os_fotos_updated_at before update on os_fotos for each row execute function set_updated_at();

drop trigger if exists set_cotacoes_updated_at on cotacoes;
create trigger set_cotacoes_updated_at before update on cotacoes for each row execute function set_updated_at();

drop trigger if exists set_cotacao_itens_updated_at on cotacao_itens;
create trigger set_cotacao_itens_updated_at before update on cotacao_itens for each row execute function set_updated_at();

drop trigger if exists set_respostas_fornecedor_updated_at on respostas_fornecedor;
create trigger set_respostas_fornecedor_updated_at before update on respostas_fornecedor for each row execute function set_updated_at();

drop trigger if exists set_orcamentos_updated_at on orcamentos;
create trigger set_orcamentos_updated_at before update on orcamentos for each row execute function set_updated_at();

drop trigger if exists set_orcamento_revisoes_updated_at on orcamento_revisoes;
create trigger set_orcamento_revisoes_updated_at before update on orcamento_revisoes for each row execute function set_updated_at();

drop trigger if exists set_financeiro_updated_at on financeiro;
create trigger set_financeiro_updated_at before update on financeiro for each row execute function set_updated_at();

drop trigger if exists set_timeline_os_updated_at on timeline_os;
create trigger set_timeline_os_updated_at before update on timeline_os for each row execute function set_updated_at();

drop trigger if exists set_produtos_updated_at on produtos;
create trigger set_produtos_updated_at before update on produtos for each row execute function set_updated_at();

drop trigger if exists set_notas_fiscais_updated_at on notas_fiscais;
create trigger set_notas_fiscais_updated_at before update on notas_fiscais for each row execute function set_updated_at();

drop trigger if exists set_estoque_movimentacoes_updated_at on estoque_movimentacoes;
create trigger set_estoque_movimentacoes_updated_at before update on estoque_movimentacoes for each row execute function set_updated_at();

drop trigger if exists set_servicos_catalogo_updated_at on servicos_catalogo;
create trigger set_servicos_catalogo_updated_at before update on servicos_catalogo for each row execute function set_updated_at();

drop trigger if exists set_feedbacks_updated_at on feedbacks;
create trigger set_feedbacks_updated_at before update on feedbacks for each row execute function set_updated_at();

-- ============================================================================
-- RPCS
-- ============================================================================

-- As RPCs abaixo existem no banco de producao.
-- Este arquivo versiona apenas as assinaturas para referencia.
-- Quando o corpo de uma RPC mudar, atualizar a funcao real pelo SQL Editor.

-- get_oficina_id() returns uuid
-- criar_oficina_e_usuario(p_nome_oficina text, p_whatsapp text, p_nome_usuario text, p_email text) returns jsonb
-- gerar_recibo_token(p_orcamento_id uuid) returns uuid
-- public_approve_orcamento(p_public_token uuid, p_aprovado_ip text default null) returns jsonb
-- public_get_cotacao(p_cotacao_id uuid) returns jsonb
-- public_get_orcamento(p_public_token uuid) returns jsonb
-- public_get_recibo(p_recibo_token uuid) returns jsonb
-- public_submit_cotacao_response(p_cotacao_id uuid, p_items jsonb) returns jsonb

-- ============================================================================
-- RLS ENABLE
-- ============================================================================

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
alter table produtos enable row level security;
alter table notas_fiscais enable row level security;
alter table estoque_movimentacoes enable row level security;
alter table servicos_catalogo enable row level security;
alter table feedbacks enable row level security;

-- ============================================================================
-- POLICIES
-- ============================================================================

drop policy if exists oficinas_select on oficinas;
create policy oficinas_select on oficinas for select to authenticated using (id = get_oficina_id());
drop policy if exists oficinas_insert on oficinas;
create policy oficinas_insert on oficinas for insert to authenticated with check (true);
drop policy if exists oficinas_update on oficinas;
create policy oficinas_update on oficinas for update to authenticated using (id = get_oficina_id());
drop policy if exists oficinas_delete on oficinas;
create policy oficinas_delete on oficinas for delete to authenticated using (id = get_oficina_id());

drop policy if exists usuarios_select on usuarios;
create policy usuarios_select on usuarios for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists usuarios_insert on usuarios;
create policy usuarios_insert on usuarios for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists usuarios_update on usuarios;
create policy usuarios_update on usuarios for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists usuarios_delete on usuarios;
create policy usuarios_delete on usuarios for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists clientes_insert on clientes;
create policy clientes_insert on clientes for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists clientes_update on clientes;
create policy clientes_update on clientes for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists clientes_delete on clientes;
create policy clientes_delete on clientes for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists veiculos_select on veiculos;
create policy veiculos_select on veiculos for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists veiculos_insert on veiculos;
create policy veiculos_insert on veiculos for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists veiculos_update on veiculos;
create policy veiculos_update on veiculos for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists veiculos_delete on veiculos;
create policy veiculos_delete on veiculos for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists fornecedores_select on fornecedores;
create policy fornecedores_select on fornecedores for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists fornecedores_insert on fornecedores;
create policy fornecedores_insert on fornecedores for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists fornecedores_update on fornecedores;
create policy fornecedores_update on fornecedores for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists fornecedores_delete on fornecedores;
create policy fornecedores_delete on fornecedores for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists ordens_servico_select on ordens_servico;
create policy ordens_servico_select on ordens_servico for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists ordens_servico_insert on ordens_servico;
create policy ordens_servico_insert on ordens_servico for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists ordens_servico_update on ordens_servico;
create policy ordens_servico_update on ordens_servico for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists ordens_servico_delete on ordens_servico;
create policy ordens_servico_delete on ordens_servico for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists os_pecas_select on os_pecas;
create policy os_pecas_select on os_pecas for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists os_pecas_insert on os_pecas;
create policy os_pecas_insert on os_pecas for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists os_pecas_update on os_pecas;
create policy os_pecas_update on os_pecas for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists os_pecas_delete on os_pecas;
create policy os_pecas_delete on os_pecas for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists os_servicos_select on os_servicos;
create policy os_servicos_select on os_servicos for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists os_servicos_insert on os_servicos;
create policy os_servicos_insert on os_servicos for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists os_servicos_update on os_servicos;
create policy os_servicos_update on os_servicos for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists os_servicos_delete on os_servicos;
create policy os_servicos_delete on os_servicos for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists os_fotos_select on os_fotos;
create policy os_fotos_select on os_fotos for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists os_fotos_insert on os_fotos;
create policy os_fotos_insert on os_fotos for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists os_fotos_update on os_fotos;
create policy os_fotos_update on os_fotos for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists os_fotos_delete on os_fotos;
create policy os_fotos_delete on os_fotos for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists cotacoes_select on cotacoes;
create policy cotacoes_select on cotacoes for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists cotacoes_insert on cotacoes;
create policy cotacoes_insert on cotacoes for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists cotacoes_update on cotacoes;
create policy cotacoes_update on cotacoes for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists cotacoes_delete on cotacoes;
create policy cotacoes_delete on cotacoes for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists cotacao_itens_select on cotacao_itens;
create policy cotacao_itens_select on cotacao_itens for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists cotacao_itens_insert on cotacao_itens;
create policy cotacao_itens_insert on cotacao_itens for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists cotacao_itens_update on cotacao_itens;
create policy cotacao_itens_update on cotacao_itens for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists cotacao_itens_delete on cotacao_itens;
create policy cotacao_itens_delete on cotacao_itens for delete to authenticated using (oficina_id = get_oficina_id());
drop policy if exists cotacao_itens_select_public on cotacao_itens;
create policy cotacao_itens_select_public on cotacao_itens for select to anon using (true);

drop policy if exists respostas_fornecedor_select on respostas_fornecedor;
create policy respostas_fornecedor_select on respostas_fornecedor for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists respostas_fornecedor_insert on respostas_fornecedor;
create policy respostas_fornecedor_insert on respostas_fornecedor for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists respostas_fornecedor_update on respostas_fornecedor;
create policy respostas_fornecedor_update on respostas_fornecedor for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists respostas_fornecedor_delete on respostas_fornecedor;
create policy respostas_fornecedor_delete on respostas_fornecedor for delete to authenticated using (oficina_id = get_oficina_id());
drop policy if exists respostas_fornecedor_insert_public on respostas_fornecedor;
create policy respostas_fornecedor_insert_public on respostas_fornecedor for insert to anon with check (true);

drop policy if exists orcamentos_select on orcamentos;
create policy orcamentos_select on orcamentos for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists orcamentos_insert on orcamentos;
create policy orcamentos_insert on orcamentos for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists orcamentos_update on orcamentos;
create policy orcamentos_update on orcamentos for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists orcamentos_delete on orcamentos;
create policy orcamentos_delete on orcamentos for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists orcamento_revisoes_select on orcamento_revisoes;
create policy orcamento_revisoes_select on orcamento_revisoes for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists orcamento_revisoes_insert on orcamento_revisoes;
create policy orcamento_revisoes_insert on orcamento_revisoes for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists orcamento_revisoes_update on orcamento_revisoes;
create policy orcamento_revisoes_update on orcamento_revisoes for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists orcamento_revisoes_delete on orcamento_revisoes;
create policy orcamento_revisoes_delete on orcamento_revisoes for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists financeiro_select on financeiro;
create policy financeiro_select on financeiro for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists financeiro_insert on financeiro;
create policy financeiro_insert on financeiro for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists financeiro_update on financeiro;
create policy financeiro_update on financeiro for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists financeiro_delete on financeiro;
create policy financeiro_delete on financeiro for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists timeline_os_select on timeline_os;
create policy timeline_os_select on timeline_os for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists timeline_os_insert on timeline_os;
create policy timeline_os_insert on timeline_os for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists timeline_os_update on timeline_os;
create policy timeline_os_update on timeline_os for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists timeline_os_delete on timeline_os;
create policy timeline_os_delete on timeline_os for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists produtos_select on produtos;
create policy produtos_select on produtos for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists produtos_insert on produtos;
create policy produtos_insert on produtos for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists produtos_update on produtos;
create policy produtos_update on produtos for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists produtos_delete on produtos;
create policy produtos_delete on produtos for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists notas_fiscais_select on notas_fiscais;
create policy notas_fiscais_select on notas_fiscais for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists notas_fiscais_insert on notas_fiscais;
create policy notas_fiscais_insert on notas_fiscais for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists notas_fiscais_update on notas_fiscais;
create policy notas_fiscais_update on notas_fiscais for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists notas_fiscais_delete on notas_fiscais;
create policy notas_fiscais_delete on notas_fiscais for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists estoque_movimentacoes_select on estoque_movimentacoes;
create policy estoque_movimentacoes_select on estoque_movimentacoes for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists estoque_movimentacoes_insert on estoque_movimentacoes;
create policy estoque_movimentacoes_insert on estoque_movimentacoes for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists estoque_movimentacoes_update on estoque_movimentacoes;
create policy estoque_movimentacoes_update on estoque_movimentacoes for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists estoque_movimentacoes_delete on estoque_movimentacoes;
create policy estoque_movimentacoes_delete on estoque_movimentacoes for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists servicos_catalogo_select on servicos_catalogo;
create policy servicos_catalogo_select on servicos_catalogo for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists servicos_catalogo_insert on servicos_catalogo;
create policy servicos_catalogo_insert on servicos_catalogo for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists servicos_catalogo_update on servicos_catalogo;
create policy servicos_catalogo_update on servicos_catalogo for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists servicos_catalogo_delete on servicos_catalogo;
create policy servicos_catalogo_delete on servicos_catalogo for delete to authenticated using (oficina_id = get_oficina_id());

drop policy if exists feedbacks_select on feedbacks;
create policy feedbacks_select on feedbacks for select to authenticated using (oficina_id = get_oficina_id());
drop policy if exists feedbacks_insert on feedbacks;
create policy feedbacks_insert on feedbacks for insert to authenticated with check (oficina_id = get_oficina_id());
drop policy if exists feedbacks_update on feedbacks;
create policy feedbacks_update on feedbacks for update to authenticated using (oficina_id = get_oficina_id());
drop policy if exists feedbacks_delete on feedbacks;
create policy feedbacks_delete on feedbacks for delete to authenticated using (oficina_id = get_oficina_id());
