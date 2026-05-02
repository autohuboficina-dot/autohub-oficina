import { normalizeRole, type UserRole } from "../accessControl";
import { supabase } from "../lib/supabase";
import {
  deleteUsuario,
  defaultOficinaConfiguracoes,
  getConfiguracoesOficina,
  getUsuarios,
  saveConfiguracoesOficina,
  saveUsuario,
  updateUsuario,
  type DescontoPagamento,
  type OficinaConfiguracoes,
  type UsuarioSistema,
} from "../pages/configuracoes/configuracoesStorage";

const ROLE_STORAGE_KEY = "autohub:perfil";

type OficinaSupabaseRow = {
  nome: string | null;
  cnpj: string | null;
  whatsapp: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  logo_url: string | null;
  chave_pix: string | null;
  texto_padrao_orcamento: string | null;
  politica_entrada_sinal: string | null;
  regras_pagamento: OficinaConfiguracoes["regrasPagamento"] | null;
};

export type {
  DescontoPagamento,
  OficinaConfiguracoes,
  RegrasPagamento,
  UsuarioSistema,
  UsuarioStatus,
} from "../pages/configuracoes/configuracoesStorage";

export {
  calculatePaymentSimulation,
  defaultOficinaConfiguracoes,
  deleteUsuario,
  getConfiguracoesOficina,
  getUsuarios,
  saveConfiguracoesOficina,
  saveUsuario,
  updateUsuario,
} from "../pages/configuracoes/configuracoesStorage";

function normalizeConfig(config: Partial<OficinaConfiguracoes>) {
  const mergedConfig = {
    ...defaultOficinaConfiguracoes,
    ...config,
    regrasPagamento:
      config.regrasPagamento ?? defaultOficinaConfiguracoes.regrasPagamento,
  };

  return {
    ...mergedConfig,
    regrasPagamento: {
      pix: normalizeDiscountRule(mergedConfig.regrasPagamento.pix),
      dinheiro: normalizeDiscountRule(mergedConfig.regrasPagamento.dinheiro),
      debito: normalizeDiscountRule(mergedConfig.regrasPagamento.debito),
      credito: {
        maxParcelas: Math.max(
          Number(mergedConfig.regrasPagamento.credito?.maxParcelas || 1),
          1,
        ),
        parcelasSemJuros: Math.max(
          Number(mergedConfig.regrasPagamento.credito?.parcelasSemJuros || 1),
          1,
        ),
        taxaParcelamentoPercentual: Number(
          mergedConfig.regrasPagamento.credito?.taxaParcelamentoPercentual || 0,
        ),
        repassarTaxaCliente: Boolean(
          mergedConfig.regrasPagamento.credito?.repassarTaxaCliente,
        ),
      },
    },
  };
}

function normalizeDiscountRule(
  rule: Partial<DescontoPagamento> | undefined,
): DescontoPagamento {
  return {
    tipo: rule?.tipo === "valor" ? "valor" : "percentual",
    valor: Number(rule?.valor || 0),
  };
}

function mapOficinaFromSupabase(row: OficinaSupabaseRow): OficinaConfiguracoes {
  return normalizeConfig({
    nomeOficina: row.nome ?? defaultOficinaConfiguracoes.nomeOficina,
    cnpj: row.cnpj ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? "",
    endereco: row.endereco ?? "",
    cidade: row.cidade ?? "",
    logo: row.logo_url ?? "",
    chavePix: row.chave_pix ?? "",
    textoPadraoOrcamento:
      row.texto_padrao_orcamento ??
      defaultOficinaConfiguracoes.textoPadraoOrcamento,
    politicaEntradaSinal:
      row.politica_entrada_sinal ??
      defaultOficinaConfiguracoes.politicaEntradaSinal,
    regrasPagamento:
      row.regras_pagamento ?? defaultOficinaConfiguracoes.regrasPagamento,
  });
}

function mapOficinaToSupabase(config: OficinaConfiguracoes) {
  return {
    nome: config.nomeOficina,
    cnpj: config.cnpj,
    whatsapp: config.whatsapp,
    email: config.email,
    endereco: config.endereco,
    cidade: config.cidade,
    logo_url: config.logo,
    chave_pix: config.chavePix,
    texto_padrao_orcamento: config.textoPadraoOrcamento,
    politica_entrada_sinal: config.politicaEntradaSinal,
    regras_pagamento: config.regrasPagamento,
  };
}

export async function getConfiguracoesOficinaSupabase(oficinaId: string) {
  const localConfig = getConfiguracoesOficina();

  if (!supabase) {
    return localConfig;
  }

  const { data, error } = await supabase
    .from("oficinas")
    .select(
      "nome, cnpj, whatsapp, email, endereco, cidade, logo_url, chave_pix, texto_padrao_orcamento, politica_entrada_sinal, regras_pagamento",
    )
    .eq("id", oficinaId)
    .maybeSingle<OficinaSupabaseRow>();

  if (error || !data) {
    return localConfig;
  }

  return mapOficinaFromSupabase(data);
}

export async function saveConfiguracoesOficinaSupabase(
  oficinaId: string,
  config: OficinaConfiguracoes,
) {
  const normalizedConfig = normalizeConfig(config);

  if (!supabase) {
    return saveConfiguracoesOficina(normalizedConfig);
  }

  const { data, error } = await supabase
    .from("oficinas")
    .update(mapOficinaToSupabase(normalizedConfig))
    .eq("id", oficinaId)
    .select(
      "nome, cnpj, whatsapp, email, endereco, cidade, logo_url, chave_pix, texto_padrao_orcamento, politica_entrada_sinal, regras_pagamento",
    )
    .single<OficinaSupabaseRow>();

  if (error || !data) {
    return saveConfiguracoesOficina(normalizedConfig);
  }

  return mapOficinaFromSupabase(data);
}

export function getAll() {
  return getConfiguracoesOficina();
}

export function getById(id: "oficina") {
  return id === "oficina" ? getConfiguracoesOficina() : undefined;
}

export function create(config: OficinaConfiguracoes) {
  return saveConfiguracoesOficina(config);
}

export function update(config: OficinaConfiguracoes) {
  return saveConfiguracoesOficina(config);
}

export function remove() {
  return saveConfiguracoesOficina(getConfiguracoesOficina());
}

export function getCurrentRole() {
  if (typeof window === "undefined") {
    return "admin";
  }

  return normalizeRole(localStorage.getItem(ROLE_STORAGE_KEY));
}

export function updateCurrentRole(role: UserRole) {
  localStorage.setItem(ROLE_STORAGE_KEY, role);
  return role;
}

export const usuariosService = {
  getAll: getUsuarios,
  getById(id: string) {
    return getUsuarios().find((usuario) => usuario.id === id);
  },
  create(
    usuario: Omit<UsuarioSistema, "id" | "criadoEm" | "atualizadoEm">,
  ) {
    return saveUsuario(usuario);
  },
  update: updateUsuario,
  remove: deleteUsuario,
};

export const configuracoesService = {
  getAll,
  getById,
  create,
  update,
  remove,
  getConfiguracoesOficinaSupabase,
  saveConfiguracoesOficinaSupabase,
  getCurrentRole,
  updateCurrentRole,
};
