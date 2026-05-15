# Auditoria do Codigo - AutoHub Oficina

Data: 2026-05-15  
Escopo: varredura estatica em `src/` e `supabase/schema.sql`.  
Regra aplicada: nenhum arquivo de codigo foi alterado.

## SECAO 1 - INCONSISTENCIAS ENTRE FRONTEND E BACKEND

### `oficinas`
- Schema SQL: `id`, `nome`, `cnpj`, `whatsapp`, `email`, `endereco`, `cidade`, `logo_url`, `chave_pix`, `texto_padrao_orcamento`, `politica_entrada_sinal`, `regras_pagamento`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/configuracoesService.ts:173` envia `nome`, `cnpj`, `whatsapp`, `email`, `endereco`, `cidade`, `logo_url`, `chave_pix`, `texto_padrao_orcamento`, `politica_entrada_sinal`, `markup_pecas`, `regras_pagamento`.
- Campos enviados que nao existem no schema: `markup_pecas` (`src/services/configuracoesService.ts:30`, `src/services/configuracoesService.ts:111`).
- Obrigatorios nao enviados: nenhum em update; `nome` obrigatorio depende de `config.nomeOficina`.
- Tipo diferente: `regras_pagamento` ok como JSON; `markup_pecas` inexistente.
- Enums: nenhum.

### `usuarios`
- Schema SQL: `id`, `oficina_id`, `auth_user_id`, `nome`, `email`, `perfil`, `status`, `created_at`, `updated_at`.
- Frontend insert/update: nenhum `.from("usuarios").insert/update`; cadastro chama RPC `criar_oficina_e_usuario` em `src/pages/cadastro/Cadastro.tsx:149`.
- Campos enviados que nao existem no schema: nao avaliavel via RPC.
- Obrigatorios nao enviados: nao avaliavel via RPC.
- Tipo diferente: `perfil` local usa `admin`, `mecanico`, `atendimento`, `compras`, `financeiro`; compatível com check SQL.
- Enums/checks: compatível.

### `clientes`
- Schema SQL: `id`, `oficina_id`, `tipo`, `nome`, `telefone`, `documento`, `email`, `cidade`, `observacoes`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/clientesService.ts:362`, `src/services/clientesService.ts:402` enviam `oficina_id`, `tipo`, `nome`, `telefone`, `documento`, `email`, `cidade`, `observacoes`.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: nenhum, desde que `oficina_id` exista.
- Tipo diferente: frontend exibe `Pessoa física`, mapper converte para SQL `Pessoa fisica` em `src/services/clientesService.ts:24`.
- Enums/checks: compatível apos mapper.

### `veiculos`
- Schema SQL: `id`, `oficina_id`, `cliente_id`, `marca`, `modelo`, `ano`, `motor`, `combustivel`, `placa`, `chassi_vin`, `km_atual`, `observacoes`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/clientesService.ts:211`, `src/services/clientesService.ts:224` enviam `oficina_id`, `cliente_id`, `marca`, `modelo`, `ano`, `motor`, `combustivel`, `placa`, `chassi_vin`, `observacoes`.
- Campos enviados que nao existem no schema: nenhum.
- Campos usados no frontend e nao persistidos no schema: `tipo_veiculo` (`src/services/clientesService.ts:43`, `src/services/osService.ts:32`); o mapper descarta em `src/services/clientesService.ts:117`.
- Obrigatorios nao enviados: `modelo` pode ir vazio; SQL exige `not null`, mas nao valida string vazia.
- Tipo diferente: `km_atual numeric` nao enviado; frontend usa `kmAtual` string.
- Enums: nenhum.

### `fornecedores`
- Schema SQL: `id`, `oficina_id`, `nome`, `whatsapp`, `categoria`, `observacoes`, `created_at`, `updated_at`.
- Frontend insert/update: nao ha Supabase; localStorage em `src/pages/fornecedores/fornecedoresStorage.ts:70`.
- Campos enviados que nao existem no schema: nenhum via Supabase.
- Obrigatorios nao enviados: todos, porque CRUD ainda nao usa backend.
- Tipo diferente: local usa `categoria` string livre; SQL limita categorias.
- Enums/checks: risco de valores locais fora de `('Pecas','Pneus','Oleo e lubrificantes','Eletrica','Funilaria','Servicos terceirizados','Outros')`.

### `ordens_servico`
- Schema SQL: `id`, `oficina_id`, `cliente_id`, `veiculo_id`, `codigo`, `version`, `status`, `problema_relatado`, `observacao`, `diagnostico`, `checklist_inicial`, `status_orcamento`, `exige_entrada`, `tipo_entrada`, `valor_entrada`, `percentual_entrada`, `entrada_calculada`, `saldo_restante`, `status_entrada`, `data_pagamento_entrada`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/osService.ts:849`, `src/services/osService.ts:919` enviam `oficina_id`, `cliente_id`, `veiculo_id`, `codigo`, `status`, `problema_relatado`, `observacao`, `diagnostico`, `version` no update.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: campos de entrada/orcamento existem com default; `checklist_inicial` nao enviado, apesar de existir no schema.
- Campos frontend nao persistidos no backend: `exigeEntrada`, `tipoEntrada`, `valorEntrada`, `percentualEntrada`, `entradaCalculada`, `saldoRestante`, `statusEntrada`, `dataPagamentoEntrada`, `checklistInicial`.
- Tipo diferente: `diagnostico` ok JSON; valores de KM/data dentro de JSON sao string.
- Enums/checks: `ServiceOrderStatus` precisa bater com `os_status`; valores vistos sao compatíveis.

### `os_pecas`
- Schema SQL: `id`, `oficina_id`, `ordem_servico_id`, `cotacao_item_id`, `nome`, `quantidade`, `valor_unitario`, `valor_total`, `origem_checklist`, `fornecedor_escolhido`, `marca_escolhida`, `observacao`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/osService.ts:542`, `src/services/cotacoesService.ts:679`, `src/services/cotacoesService.ts:684` enviam `oficina_id`, `ordem_servico_id`, `cotacao_item_id`, `nome`, `quantidade`, `valor_unitario`, `origem_checklist`, `fornecedor_escolhido`, `marca_escolhida`, `observacao`.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: nenhum.
- Campos frontend nao persistidos: `peca_cliente`, `baixaProcessada`, `observacao_tecnica`, `compraId`, `custoFornecedorPeca`, `markupPecasAplicado`, `valorComMarkup`.
- Tipo diferente: frontend `id` numerico para itens locais; Supabase `id uuid`.
- Enums: nenhum.

### `os_servicos`
- Schema SQL: `id`, `oficina_id`, `ordem_servico_id`, `servico`, `descricao`, `valor`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/osService.ts:550` envia `oficina_id`, `ordem_servico_id`, `servico`, `descricao`, `valor`.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: nenhum.
- Tipo diferente: frontend `id` numerico para itens locais; Supabase `id uuid`.
- Enums: nenhum.

### `os_fotos`
- Schema SQL: `id`, `oficina_id`, `ordem_servico_id`, `titulo`, `tipo`, `visibilidade`, `storage_path`, `mime_type`, `tamanho_bytes`, `created_at`, `updated_at`.
- Frontend insert/update: nenhum Supabase; fotos ficam em `ServiceOrderPhoto`/localStorage.
- Campos enviados que nao existem no schema: nenhum via Supabase.
- Obrigatorios nao enviados: todos, porque nao ha persistencia Supabase.
- Tipo diferente: frontend usa `dataUrl` base64; schema espera `storage_path`.
- Enums/checks: frontend precisa mapear para `foto_visibilidade` e `tipo` SQL antes de migrar.

### `cotacoes`
- Schema SQL: `id`, `oficina_id`, `ordem_servico_id`, `fornecedor_id`, `status`, `observacao`, `enviada_em`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/cotacoesService.ts:426`, `src/services/cotacoesService.ts:475`, `src/services/cotacoesService.ts:613`, `src/pages/os/OSDetail.tsx:1863` enviam `oficina_id`, `ordem_servico_id`, `fornecedor_id`, `status`, `observacao`.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: nenhum em `cotacoesService`; em `OSDetail.tsx:1863`, depende de `resolvedOficinaId`.
- Tipo diferente: `ordem_servico_id` SQL `uuid not null`; local pode ser codigo/string e cair em localStorage.
- Enums/checks: frontend `"Fornecedor escolhido"` mapeia para `SELECIONADA`, mas SQL tambem tem `FORNECEDOR_ESCOLHIDO`; duplicidade semantica.

### `cotacao_itens`
- Schema SQL: `id`, `oficina_id`, `cotacao_id`, `nome_peca`, `quantidade`, `observacao`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/cotacoesService.ts:452`, `src/pages/os/OSDetail.tsx:1878` enviam `oficina_id`, `cotacao_id`, `nome_peca`, `quantidade`, `observacao`.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: nenhum.
- Tipo diferente: frontend `peca` vira `nome_peca`.
- Enums: nenhum.

### `respostas_fornecedor`
- Schema SQL: `id`, `oficina_id`, `cotacao_id`, `cotacao_item_id`, `fornecedor_id`, `preco`, `marca`, `observacao`, `data_resposta`, `escolhido`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/cotacoesService.ts:534`, `src/services/cotacoesService.ts:582`, `src/services/cotacoesService.ts:596`; RPC publica em `src/services/cotacoesService.ts:749` e `src/pages/cotacao/CotacaoPublica.tsx:189`.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: `oficina_id` nasce vazio no payload intermediario em `src/services/cotacoesService.ts:500`, corrigido antes do insert em `src/services/cotacoesService.ts:534`.
- Tipo diferente: frontend item response usa `preco_unitario`; RPC converte para `preco`.
- Enums: nenhum.

### `orcamentos`
- Schema SQL: `id`, `oficina_id`, `ordem_servico_id`, `public_token`, `public_expires_at`, `aprovado_em`, `aprovado_ip`, `version`, `status`, `total_pecas`, `total_mao_de_obra`, `desconto_tipo`, `desconto_valor`, `desconto_aplicado`, `forma_pagamento`, `total_final`, `itens_aprovados`, `observacao_aprovacao`, `data_decisao`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/osService.ts:626`, `src/services/osService.ts:633` enviam `oficina_id`, `ordem_servico_id`, `status`, `total_pecas`, `total_mao_de_obra`, `desconto_tipo`, `desconto_valor`, `desconto_aplicado`, `total_final`.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: nenhum por defaults; `forma_pagamento`, `itens_aprovados`, `observacao_aprovacao`, `data_decisao` nao persistidos no draft.
- Tipo diferente: frontend desconto usa `"money" | "percent"` e mapper salva `"valor" | "percentual"`; parcial.
- Enums/checks: frontend status de aprovacao local em minusculo (`pendente`, etc.) difere do enum SQL (`PENDENTE`, `APROVADO`, etc.).

### `orcamento_revisoes`
- Schema SQL: `id`, `oficina_id`, `ordem_servico_id`, `orcamento_id`, `numero_revisao`, `motivo`, `dados_anteriores`, `dados_novos`, `created_at`, `updated_at`.
- Frontend insert/update: nenhum uso encontrado.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: todos, porque revisoes nao sao persistidas.
- Tipo diferente: nao avaliado.
- Enums: nenhum.

### `financeiro`
- Schema SQL: `id`, `oficina_id`, `ordem_servico_id`, `cotacao_id`, `tipo`, `descricao`, `valor`, `data_lancamento`, `status`, `categoria`, `origem`, `origem_id`, `created_at`, `updated_at`.
- Frontend insert/update: nao ha Supabase; localStorage em `src/pages/financeiro/financeiroStorage.ts:83`.
- Campos enviados que nao existem no schema: nenhum via Supabase.
- Obrigatorios nao enviados: todos, porque CRUD ainda nao usa backend.
- Tipo diferente: frontend usa `data`; SQL usa `data_lancamento`.
- Enums/checks: frontend precisa bater com `ENTRADA/SAIDA`, `PENDENTE/PAGO/CANCELADO`, `OS/Compra/Manual`.

### `timeline_os`
- Schema SQL: `id`, `oficina_id`, `ordem_servico_id`, `usuario_id`, `tipo`, `tipo_evento`, `titulo`, `descricao`, `status_anterior`, `status_novo`, `data_evento`, `created_at`, `updated_at`.
- Frontend insert/update: `src/services/osService.ts:428` envia `id`, `oficina_id`, `ordem_servico_id`, `tipo`, `tipo_evento`, `titulo`, `descricao`, `status_anterior`, `status_novo`, `data_evento`.
- Campos enviados que nao existem no schema: nenhum.
- Obrigatorios nao enviados: nenhum; `usuario_id` opcional.
- Tipo diferente: `id` pode ser local string nao uuid; mapper evita enviar se nao for uuid.
- Enums/checks: `status_anterior/status_novo` dependem de `os_status`.

### Funcoes RPC referenciadas mas nao declaradas no schema versionado
- `src/pages/cadastro/Cadastro.tsx:149`: `criar_oficina_e_usuario` nao aparece em `supabase/schema.sql`.
- `src/pages/os/OSDetail.tsx:970`: `gerar_recibo_token` nao aparece em `supabase/schema.sql`.
- `src/pages/recibo/ReciboPublico.tsx:108`: `public_get_recibo` nao aparece em `supabase/schema.sql`.

## SECAO 2 - BOTOES SEM PROTECAO CONTRA DUPLO CLIQUE

Padrao amplo: foram encontrados 112 `<button`; abaixo estao os botoes que disparam escrita/RPC/localStorage+navegacao e estao incompletos.

| Arquivo:linha | Botao/acao | O que falta |
|---|---|---|
| `src/pages/cadastro/Cadastro.tsx:333` | `Criar minha conta` | Falta bloqueio `if (isLoading) return`; falta `try/finally`; RPC pode deixar loading preso em excecao. |
| `src/pages/auth/Login.tsx:145` | `Entrar` | Falta bloqueio `if (isLoading) return`; falta `try/finally`; excecao em auth deixa loading preso. |
| `src/pages/cotacao/CotacaoPublica.tsx:393` | `Enviar cotação` | Tem loading/disabled, mas falta bloqueio `if (isSubmitting) return`; falta `try/finally`. |
| `src/pages/orcamento/OrcamentoView.tsx:980` | `Aprovar orçamento` publico | Tem loading/disabled/bloqueio, mas falta `try/finally`; RPC pode deixar `isSubmittingDecision` preso. |
| `src/pages/clientes/Clientes.tsx:428` | Submit de cliente | Falta estado de loading de salvamento; falta `disabled`; falta bloqueio; falta `finally`. |
| `src/pages/clientes/Clientes.tsx:863` | Excluir cliente | Falta estado de loading; falta `disabled`; falta bloqueio; falta `finally`. |
| `src/pages/financeiro/Financeiro.tsx:532` | Salvar lancamento manual | Falta loading; falta `disabled`; falta bloqueio; falta `try/finally`. |
| `src/pages/financeiro/Financeiro.tsx:721` | Alternar status financeiro | Falta loading; falta `disabled`; falta bloqueio; falta `try/finally`. |
| `src/pages/financeiro/Financeiro.tsx:731` | Excluir lancamento | Falta loading; falta `disabled`; falta bloqueio; falta `try/finally`. |
| `src/pages/fornecedores/Fornecedores.tsx:153` | Submit fornecedor | Falta loading; falta `disabled`; falta bloqueio; falta `try/finally`. |
| `src/pages/fornecedores/Fornecedores.tsx:296` | Excluir fornecedor | Falta loading; falta `disabled`; falta bloqueio; falta `try/finally`. |
| `src/pages/compras/Compras.tsx:354` | Compra avulsa / cotacao | Falta loading; falta `disabled`; falta bloqueio; falta `try/finally`. |
| `src/pages/estoque/Estoque.tsx:503` | Submit produto | Falta loading; falta `disabled`; falta bloqueio; falta `try/finally`. |
| `src/pages/estoque/Estoque.tsx:891` | Confirmar importacao XML | Falta loading; falta `disabled`; falta bloqueio; falta `try/finally`. |
| `src/pages/estoque/Estoque.tsx:909` | Movimentacao manual | Falta loading; falta `disabled`; falta bloqueio; falta `try/finally`. |
| `src/pages/os/OSNew.tsx:1176` | `Solicitar cotação` apos salvar OS | Navega apos estado salvo; falta loading/disabled/bloqueio/try-finally. |
| `src/pages/os/OSNew.tsx:1184` | `Enviar orçamento` apos salvar OS | Abre link/navega; falta loading/disabled/bloqueio/try-finally. |
| `src/pages/os/OSDetail.tsx:3580` | Enviar cotacao do modal | Falta `actionInProgress` dedicado; nao desabilita o botao; `handleSendQuote` nao tem `try/finally`. |
| `src/pages/os/OSDetail.tsx:3333` | Confirmar compra/fornecedor por peca | Usa handler async; protecao depende de disabled por escolha, nao ha bloqueio global claro para duplo clique por item. |

## SECAO 3 - FEEDBACK VISUAL AO USUARIO

| Arquivo:linha | Acao | O que falta |
|---|---|---|
| `src/pages/auth/Login.tsx:31` | Login | Sem `try/catch`; erros de rede podem nao exibir mensagem amigavel. |
| `src/pages/cadastro/Cadastro.tsx:104` | Cadastro/RPC oficina | Sem `try/catch`; sem toast de sucesso/erro, apenas mensagem inline. |
| `src/pages/clientes/Clientes.tsx:189` | Excluir cliente | Erro inline existe; falta toast/sucesso explicito apos exclusao. |
| `src/pages/clientes/Clientes.tsx:299` | Criar/editar cliente | Erro inline existe; falta toast/sucesso explicito. |
| `src/pages/financeiro/Financeiro.tsx:370` | Criar lancamento manual | Sem toast/mensagem de sucesso/erro; sem `try/catch`. |
| `src/pages/financeiro/Financeiro.tsx:400` | Alternar status financeiro | Sem toast/mensagem; sem `try/catch`. |
| `src/pages/financeiro/Financeiro.tsx:413` | Excluir lancamento | Sem toast/mensagem; sem `try/catch`. |
| `src/pages/fornecedores/Fornecedores.tsx:66` | Criar/editar fornecedor | Sem toast/mensagem de sucesso/erro; sem `try/catch`. |
| `src/pages/fornecedores/Fornecedores.tsx:116` | Excluir fornecedor | Sem toast/mensagem de sucesso/erro; sem `try/catch`. |
| `src/pages/compras/Compras.tsx:152` | Compra avulsa / cotacao | Sem toast/mensagem de sucesso/erro; sem `try/catch`. |
| `src/pages/estoque/Estoque.tsx:224` | Criar/editar produto | Sem toast/mensagem; sem `try/catch`. |
| `src/pages/estoque/Estoque.tsx:323` | Importar XML confirmado | Sem toast/mensagem; sem `try/catch`. |
| `src/pages/estoque/Estoque.tsx:373` | Movimentacao manual | Sem toast/mensagem; sem `try/catch`. |
| `src/pages/orcamento/OrcamentoView.tsx:520` | Pre-aprovar orcamento local | Sem toast; usa estado local, sem tratamento de excecao. |
| `src/pages/orcamento/OrcamentoView.tsx:603` | Rejeitar orcamento local | Sem toast; usa estado local, sem tratamento de excecao. |
| `src/pages/orcamento/OrcamentoView.tsx:655` | Solicitar revisao local | Sem toast; usa estado local, sem tratamento de excecao. |
| `src/pages/recibo/ReciboPublico.tsx:108` | Buscar recibo publico | Ignora `error`; usuario recebe estado generico. |

## SECAO 4 - useEffect E HOOKS

| Arquivo:linha | Verificacao |
|---|---|
| `src/components/Toast.tsx:39` | Usa timeout; cleanup esperado. Sem POST/PUT. |
| `src/contexts/AuthContext.tsx:70` | Auth subscription/load inicial; cleanup esperado. Sem POST/PUT. |
| `src/pages/auth/Login.tsx:27` | Redireciona se autenticado; dependencias provavelmente ok. Sem POST/PUT. |
| `src/pages/orcamento/OrcamentoView.tsx:379` | Fetch publico com flag `isMounted`; cleanup ok. Sem POST/PUT. |
| `src/pages/fornecedor/FornecedorCotacaoView.tsx:99` | Fetch publico; usa `void loadCotacao`; sem cleanup/cancelamento. Sem POST/PUT. |
| `src/pages/recibo/ReciboPublico.tsx:96` | RPC publico; sem tratamento de `error`; sem cleanup/cancelamento. Sem POST/PUT. |
| `src/pages/configuracoes/Configuracoes.tsx:194` | Carrega config e escreve localStorage via service ao carregar (`saveConfiguracoesOficina`); pode causar escrita em efeito. |
| `src/pages/os/OSNew.tsx:135` | Carrega clientes; tem `isMounted`; dependencias ok. Sem POST/PUT. |
| `src/pages/os/OSList.tsx:114` | Carrega OS e sincroniza status; pode escrever localStorage dentro do efeito por `syncOrdersStatusFromSupabase`. |
| `src/pages/cotacao/CotacaoPublica.tsx:69` | RPC publico; usa `void loadCotacao`; sem cleanup/cancelamento. Sem POST/PUT. |
| `src/pages/clientes/ClienteDetail.tsx:42` | Carrega cliente; sem cleanup/cancelamento. Sem POST/PUT. |
| `src/pages/clientes/Clientes.tsx:126` | Carrega clientes; tem `isMounted`; dependencias ok. Sem POST/PUT. |
| `src/pages/os/OSDetail.tsx:803` | Carrega OS; tem `isMounted`; tambem sincroniza status/localStorage indiretamente. |
| `src/pages/os/OSDetail.tsx:846` | Carrega cotacoes da OS; sem cleanup/cancelamento. Sem POST/PUT. |
| `src/pages/os/OSDetail.tsx:871` | Recalcula estado local a partir da OS; pode disparar muito por dependencia ampla `order`. Sem POST/PUT. |
| `src/pages/os/OSDetail.tsx:938` | Gera link de recibo via RPC `gerar_recibo_token`; faz escrita/geracao em `useEffect`, sinal de bug por acontecer ao abrir modal. |

## SECAO 5 - DUPLICACAO LOCALSTORAGE vs SUPABASE

| Operacao CRUD | Persistencia atual | Fonte da verdade na leitura | Risco |
|---|---|---|---|
| OS criar | Supabase + espelho localStorage (`src/services/osService.ts:849`, `src/services/osService.ts:273`) | Supabase se retorna dados; fallback localStorage (`src/services/osService.ts:725`) | Alto: OS pode existir no Supabase sem itens/orcamento se sync posterior falhar. |
| OS atualizar | Supabase + espelho localStorage (`src/services/osService.ts:919`) | Supabase com fallback localStorage | Alto: delete+insert de itens pode apagar dados se etapa intermediaria falhar. |
| OS excluir | localStorage apenas (`src/services/osService.ts:719`) | localStorage/Supabase misto | Alto: exclusao local nao remove backend. |
| Clientes criar/editar/excluir | Supabase quando `oficina_id`; localStorage fallback (`src/services/clientesService.ts:350`, `src/services/clientesService.ts:393`, `src/services/clientesService.ts:435`) | Supabase com fallback localStorage | Alto: cliente criado no Supabase pode ficar sem veiculos se sync falhar. |
| Veiculos sincronizar | Supabase delete/update/insert; sem espelho direto | Lidos via Supabase; fallback cliente local | Alto: `tipo_veiculo` nao persiste. |
| Cotacoes criar | Supabase + espelho localStorage (`src/services/cotacoesService.ts:426`, `src/services/cotacoesService.ts:136`) | Supabase com fallback localStorage | Alto: fallback local se `osId/fornecedorId` nao uuid cria registros nao migrados. |
| Cotacoes atualizar/respostas | localStorage primeiro + Supabase depois (`src/services/cotacoesService.ts:468`) | Supabase com fallback localStorage | Alto: falha Supabase deixa local divergente. |
| Fornecedores CRUD | localStorage apenas | localStorage | Medio: schema existe, mas sem backend. |
| Estoque/produtos CRUD | localStorage apenas | localStorage | Medio: nao existe tabela no schema listado. |
| Financeiro CRUD | localStorage apenas | localStorage | Alto: schema existe, mas producao nao persiste backend. |
| Configuracoes oficina | Supabase + localStorage fallback/espelho (`src/services/configuracoesService.ts:159`, `src/services/configuracoesService.ts:173`) | Supabase com fallback localStorage | Alto: envia `markup_pecas` inexistente no schema. |
| Usuarios sistema | localStorage + auth/RPC parcial | localStorage para papel atual (`src/services/configuracoesService.ts:219`) | Alto: perfil local pode divergir de `usuarios.perfil`. |
| Orcamento publico | Supabase RPC + localStorage local para decisoes antigas | Publico usa Supabase; privado pode usar local | Alto: estados de aprovacao locais e SQL divergem. |

Operacoes a unificar: OS, clientes/veiculos, cotacoes/respostas, financeiro, fornecedores, configuracoes, usuarios/perfis, estoque/produtos.

## SECAO 6 - RLS POLICIES vs FRONTEND

Observacao global: `supabase/schema.sql` habilita RLS em todas as tabelas e apenas comenta que policies ainda devem ser adicionadas. Risco P0: selects/inserts/updates autenticados podem retornar vazio ou falhar por policy ausente.

| Arquivo:linha | Chamada | `oficina_id` | Risco RLS |
|---|---|---|---|
| `src/contexts/AuthContext.tsx:28` | `usuarios.select` | Por `auth_user_id` | Se policy de `usuarios` nao permitir bootstrap por `auth.uid()`, login fica sem perfil/oficina. |
| `src/utils/getOficinaId.ts:20` | `usuarios.select` | Supabase auth | Mesmo risco de bootstrap. |
| `src/services/clientesService.ts:273` | `clientes.select` | `oficina_id` de `useAuth` | Bloqueia se null/incorreto. |
| `src/services/clientesService.ts:362` | `clientes.insert` | Payload `oficina_id` | Bloqueia se policy exigir membership nao criada. |
| `src/services/clientesService.ts:402` | `clientes.update` | Filtro + payload `oficina_id` | Bloqueia se policy nao reconhecer usuario. |
| `src/services/clientesService.ts:441` | `clientes.delete` | Filtro `oficina_id` | Bloqueia por policy; fallback local apaga so local se sem uuid. |
| `src/services/clientesService.ts:148`, `:211`, `:224` | `veiculos.select/update/insert` | Filtro/payload `oficina_id` | Bloqueia; tambem perde `tipo_veiculo`. |
| `src/services/osService.ts:732`, `:849`, `:919` | `ordens_servico` | `oficina_id` de `useAuth` | Bloqueia; fallback pode mascarar lista vazia. |
| `src/services/osService.ts:404`, `:428` | `timeline_os.delete/insert` | `oficina_id` payload/filtro | Bloqueio pode deixar OS criada sem timeline. |
| `src/services/osService.ts:542`, `:550` | `os_pecas/os_servicos.insert` | `oficina_id` payload | Bloqueio pode deixar OS sem itens. |
| `src/services/osService.ts:601`, `:626`, `:633` | `orcamentos.select/update/insert` | `oficina_id` payload/filtro | Bloqueio impede link publico. |
| `src/services/cotacoesService.ts:360`, `:426`, `:475` | `cotacoes` | Lista filtra; update nao filtra por `oficina_id` | Update depende de RLS por row; risco se policy exigir filtro explicito. |
| `src/services/cotacoesService.ts:452` | `cotacao_itens.insert` | Payload `oficina_id` | Bloqueio deixa cotacao sem itens. |
| `src/services/cotacoesService.ts:534`, `:582`, `:596` | `respostas_fornecedor` | Insert busca `oficina_id`; updates nao filtram por oficina | Risco de bloqueio por policy e risco multi-tenant se policy fraca. |
| `src/services/cotacoesService.ts:679`, `:684` | `os_pecas.update/insert` | Payload/filtro `oficina_id` | Bloqueio impede confirmar compra na OS. |
| `src/services/configuracoesService.ts:145`, `:173` | `oficinas.select/update` | Usa `id = oficinaId` | Bloqueio se usuario nao tiver policy de oficina. |
| `src/pages/os/OSDetail.tsx:205` | `ordens_servico.select` por `codigo` sem `oficina_id` | Nao filtra oficina | Risco multi-tenant e/ou policy bloquear. |
| `src/pages/os/OSDetail.tsx:957` | `orcamentos.select` | Usa helper `getOficinaId()` | Risco null se `usuarios` bloqueado. |
| `src/pages/os/OSDetail.tsx:1863` | `cotacoes.insert` | Usa helper `getOficinaId()` | Risco null/bloqueio. |
| `src/pages/os/OSDetail.tsx:1878` | `cotacao_itens.insert` | Usa `resolvedOficinaId` | Risco de cotacao criada sem itens se falhar. |
| `src/pages/cotacao/CotacaoPublica.tsx:80`, `:189` | RPC publico cotacao | RPC security definer | Nao depende de RLS comum; depende da funcao existir e validar acesso. |
| `src/pages/orcamento/OrcamentoView.tsx:283`, `:723` | RPC publico orcamento | RPC security definer | Nao depende de `oficina_id` no frontend. |
| `src/pages/recibo/ReciboPublico.tsx:108` | RPC recibo | RPC nao esta no schema | Risco de erro em producao se funcao nao existir. |
| `src/pages/cadastro/Cadastro.tsx:149` | RPC cadastro | RPC cria oficina/usuario | Funcao nao esta no schema versionado. |

## SECAO 7 - ERROS NAO TRATADOS

Padrao amplo: foram encontrados 124 `await` em `src/`; abaixo estao as 10 ocorrencias mais criticas.

| Arquivo:linha | Problema |
|---|---|
| `src/pages/cadastro/Cadastro.tsx:125` | `supabase.auth.signUp` sem `try/catch`; excecao de rede deixa loading preso. |
| `src/pages/cadastro/Cadastro.tsx:137` | `signInWithPassword` sem `try/catch`; excecao pula `setIsLoading(false)`. |
| `src/pages/cadastro/Cadastro.tsx:149` | RPC `criar_oficina_e_usuario` sem `try/catch/finally`; funcao ausente quebra fluxo. |
| `src/pages/auth/Login.tsx:44` | Login sem `try/catch/finally`; excecao deixa loading preso. |
| `src/pages/auth/Login.tsx:56` | Select `usuarios` sem tratamento de `error`; perfil pode cair silenciosamente para `atendimento`. |
| `src/utils/getOficinaId.ts:20` | Select `usuarios` ignora `error`; retorna null silenciosamente e bloqueia escritas. |
| `src/pages/cotacao/CotacaoPublica.tsx:189` | RPC submit sem `try/finally`; excecao deixa `isSubmitting` preso. |
| `src/pages/orcamento/OrcamentoView.tsx:723` | RPC aprovar orcamento sem `try/finally`; excecao deixa `isSubmittingDecision` preso. |
| `src/pages/recibo/ReciboPublico.tsx:108` | RPC recibo ignora `error`; falha vira recibo indisponivel sem diagnostico. |
| `src/services/cotacoesService.ts:468` | Atualiza localStorage antes do Supabase; falha posterior deixa divergencia sem rollback. |

Outras ocorrencias relevantes: `src/App.tsx:138`, `src/lib/supabaseTest.ts:9`, `src/pages/os/OSList.tsx:119`, `src/pages/clientes/ClienteDetail.tsx:57`, `src/pages/os/OSDetail.tsx:970`, `src/pages/os/OSDetail.tsx:1998`.

## SECAO 8 - PRIORIZACAO SUGERIDA

| Prioridade | Bug/Problema | Arquivo | Risco |
|------------|--------------|---------|-------|
| P0 - CRITICO | RLS habilitado sem policies versionadas para tabelas privadas | `supabase/schema.sql` | Bloqueia leitura/escrita Supabase em producao. |
| P0 - CRITICO | Campo `markup_pecas` enviado para `oficinas` nao existe no schema | `src/services/configuracoesService.ts:173` | Salvar configuracoes pode falhar em producao. |
| P0 - CRITICO | RPCs usadas nao existem no schema versionado | `src/pages/cadastro/Cadastro.tsx:149`, `src/pages/os/OSDetail.tsx:970`, `src/pages/recibo/ReciboPublico.tsx:108` | Cadastro/recibo podem quebrar apos deploy/migracao. |
| P0 - CRITICO | `tipo_veiculo` usado no frontend nao existe/persiste em `veiculos` | `src/services/clientesService.ts:117` | Perda de dado de veiculo na migracao para Supabase. |
| P1 - ALTO | OS cria registro principal antes de itens/orcamento/timeline | `src/services/osService.ts:849` | OS parcial se sync posterior falhar. |
| P1 - ALTO | Atualizacao de cotacao grava localStorage antes do Supabase | `src/services/cotacoesService.ts:468` | Divergencia entre local e backend. |
| P1 - ALTO | Financeiro existe no schema, mas CRUD usa so localStorage | `src/pages/financeiro/Financeiro.tsx:370` | Dados financeiros nao persistem no backend. |
| P1 - ALTO | Fornecedores existe no schema, mas CRUD usa so localStorage | `src/pages/fornecedores/Fornecedores.tsx:66` | Dados de fornecedor nao persistem no backend. |
| P1 - ALTO | Botoes de clientes/financeiro/estoque sem protecao contra duplo clique | `src/pages/clientes/Clientes.tsx:428`, `src/pages/financeiro/Financeiro.tsx:532`, `src/pages/estoque/Estoque.tsx:503` | Duplicidade de registros e estados inconsistentes. |
| P1 - ALTO | Geracao de recibo por RPC dentro de `useEffect` | `src/pages/os/OSDetail.tsx:938` | Efeito colateral automatico ao abrir modal. |
| P2 - MEDIO | Feedback visual ausente em CRUD localStorage | `src/pages/financeiro/Financeiro.tsx`, `src/pages/fornecedores/Fornecedores.tsx`, `src/pages/estoque/Estoque.tsx` | Usuario nao sabe se acao foi concluida. |
| P2 - MEDIO | Enums/status duplicados para cotacao (`SELECIONADA` vs `FORNECEDOR_ESCOLHIDO`) | `src/services/cotacoesService.ts:85` | Inconsistencia de status e filtros. |
