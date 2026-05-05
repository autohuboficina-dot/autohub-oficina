# Supabase Schema - AutoHub Oficina

Este diretorio contem a modelagem inicial de banco para uma futura migracao do AutoHub Oficina para Supabase.

## Objetivo

O arquivo `schema.sql` prepara uma base relacional multi-tenant para o SaaS, mantendo `oficina_id` nas tabelas operacionais e usando chaves estrangeiras para preservar a integridade entre oficinas, usuarios, clientes, veiculos, ordens de servico, cotacoes, orcamentos e financeiro.

O frontend ainda nao foi conectado ao Supabase. A aplicacao continua usando a camada atual com `localStorage`.

## Ordem de execucao

1. Criar um projeto Supabase.
2. Executar `supabase/schema.sql` no SQL Editor ou via migrations.
3. Revisar os enums e constraints conforme a regra de negocio final.
4. Criar as policies RLS depois que autenticacao, onboarding de oficina e vinculo `auth.users -> usuarios` estiverem definidos.
5. So entao conectar os services do frontend ao Supabase.

## Tabelas principais

- `oficinas`: tenant principal do SaaS.
- `usuarios`: usuarios da oficina, preparados para vinculo com `auth.users`.
- `clientes` e `veiculos`: cadastro operacional da oficina.
- `ordens_servico`: OS principal, com status, `version` para controle de concorrencia e dados de diagnostico/orcamento.
- `os_pecas`, `os_servicos` e `os_fotos`: detalhes da OS.
- `cotacoes`, `cotacao_itens` e `respostas_fornecedor`: fluxo de compras/cotacao com fornecedores. O fornecedor responde apenas preco, marca e observacao; urgencia e prazo nao fazem parte deste fluxo.
- `fornecedores`: cadastro de fornecedores por oficina.
- `orcamentos`: totais, descontos, status, `version` para controle de concorrencia, decisao do cliente e `public_token` para link publico seguro.
- `orcamento_revisoes`: historico de revisoes quando um orcamento enviado, aprovado ou em decisao precisa ser alterado.
- `financeiro`: lancamentos financeiros vinculados a OS, cotacao ou origem manual.
- `timeline_os`: historico de eventos e mudancas de status da OS.

## RLS

Todas as tabelas ficam com Row Level Security habilitado. As policies ainda nao foram criadas de proposito, para evitar bloquear ou expor dados antes da estrategia de autenticacao e multi-tenant estar fechada.

Os comentarios no `schema.sql` indicam onde as policies devem entrar depois.

## Orcamento publico

O link publico do cliente usa `orcamentos.public_token`, nao o `id` interno do orcamento nem o `oficina_id`. O token e um UUID unico gerado pelo banco e pode receber expiracao em `public_expires_at`.

Para manter RLS habilitado sem permitir listagem publica, o acesso anonimo deve passar pelas funcoes `public_get_orcamento(public_token)` e `public_approve_orcamento(public_token)`. Elas buscam ou aprovam apenas um orcamento pelo token, respeitam expiracao e nao retornam `oficina_id`. Ao aprovar um orcamento em `RASCUNHO`, a funcao tambem sincroniza a OS vinculada para `APROVADA`.

## Revisoes de orcamento

Depois que um orcamento for enviado ou aprovado, alteracoes relevantes devem gerar um registro em `orcamento_revisoes`, preservando `dados_anteriores`, `dados_novos`, motivo e numero sequencial da revisao por OS.

## Concorrencia e placa

Os campos `version` em `ordens_servico` e `orcamentos` serao usados futuramente para controle de concorrencia otimista quando o frontend passar a gravar no Supabase.

A placa dos veiculos usa indice unico parcial por oficina somente quando a placa esta preenchida. Assim, placa vazia nao bloqueia o cadastro de multiplos veiculos ainda sem identificacao.
