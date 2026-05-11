import { normalizeRole, type UserRole } from "../../accessControl";

export type OficinaConfiguracoes = {
  nomeOficina: string;
  cnpj: string;
  whatsapp: string;
  email: string;
  endereco: string;
  cidade: string;
  logo: string;
  chavePix: string;
  textoPadraoOrcamento: string;
  politicaEntradaSinal: string;
  markupPecas: number;
  regrasPagamento: RegrasPagamento;
};

export type DescontoPagamento = {
  tipo: "percentual" | "valor";
  valor: number;
};

export type RegrasPagamento = {
  pix: DescontoPagamento;
  dinheiro: DescontoPagamento;
  debito: DescontoPagamento;
  credito: {
    maxParcelas: number;
    parcelasSemJuros: number;
    taxaParcelamentoPercentual: number;
    repassarTaxaCliente: boolean;
  };
};

export type UsuarioStatus = "ativo" | "inativo";

export type UsuarioSistema = {
  id: string;
  nome: string;
  email: string;
  perfil: UserRole;
  status: UsuarioStatus;
  criadoEm: string;
  atualizadoEm: string;
};

const CONFIG_STORAGE_KEY = "autohub:configuracoes-oficina";
const USERS_STORAGE_KEY = "autohub:usuarios";

export const defaultOficinaConfiguracoes: OficinaConfiguracoes = {
  nomeOficina: "AutoHub Oficina",
  cnpj: "",
  whatsapp: "(11) 99999-0000",
  email: "",
  endereco: "",
  cidade: "",
  logo: "",
  chavePix: "",
  textoPadraoOrcamento:
    "Revise os itens do orçamento e responda pelo link enviado pela oficina.",
  politicaEntradaSinal:
    "Quando houver entrada/sinal, o serviço só será iniciado após confirmação do pagamento.",
  markupPecas: 0,
  regrasPagamento: {
    pix: { tipo: "percentual", valor: 0 },
    dinheiro: { tipo: "percentual", valor: 0 },
    debito: { tipo: "percentual", valor: 0 },
    credito: {
      maxParcelas: 12,
      parcelasSemJuros: 3,
      taxaParcelamentoPercentual: 0,
      repassarTaxaCliente: false,
    },
  },
};

function createUsuarioId() {
  return createSecureId("USR");
}

function normalizeConfig(config: Partial<OficinaConfiguracoes>): OficinaConfiguracoes {
  const regrasPagamento = config.regrasPagamento ?? defaultOficinaConfiguracoes.regrasPagamento;

  return {
    ...defaultOficinaConfiguracoes,
    ...config,
    markupPecas: Math.min(Math.max(Number(config.markupPecas || 0), 0), 200),
    regrasPagamento: {
      pix: {
        tipo: regrasPagamento.pix?.tipo === "valor" ? "valor" : "percentual",
        valor: Number(regrasPagamento.pix?.valor || 0),
      },
      dinheiro: {
        tipo:
          regrasPagamento.dinheiro?.tipo === "valor" ? "valor" : "percentual",
        valor: Number(regrasPagamento.dinheiro?.valor || 0),
      },
      debito: {
        tipo: regrasPagamento.debito?.tipo === "valor" ? "valor" : "percentual",
        valor: Number(regrasPagamento.debito?.valor || 0),
      },
      credito: {
        maxParcelas: Math.max(Number(regrasPagamento.credito?.maxParcelas || 1), 1),
        parcelasSemJuros: Math.max(
          Number(regrasPagamento.credito?.parcelasSemJuros || 1),
          1,
        ),
        taxaParcelamentoPercentual: Number(
          regrasPagamento.credito?.taxaParcelamentoPercentual || 0,
        ),
        repassarTaxaCliente: Boolean(
          regrasPagamento.credito?.repassarTaxaCliente,
        ),
      },
    },
  };
}

function calculateDiscount(baseValue: number, rule: DescontoPagamento) {
  if (rule.tipo === "percentual") {
    return (baseValue * Math.min(Math.max(rule.valor, 0), 100)) / 100;
  }

  return Math.min(Math.max(rule.valor, 0), baseValue);
}

export function calculatePaymentSimulation(
  totalOrcamento: number,
  entradaCalculada: number,
  exigeEntrada: boolean,
  regras: RegrasPagamento,
  forma: "Pix" | "Dinheiro" | "Débito" | "Crédito",
  parcelas = 1,
) {
  const saldoBase = Math.max(
    Number(totalOrcamento || 0) - (exigeEntrada ? Number(entradaCalculada || 0) : 0),
    0,
  );
  const selectedInstallments = Math.min(
    Math.max(Number(parcelas || 1), 1),
    Math.max(regras.credito.maxParcelas, 1),
  );

  if (forma === "Pix") {
    const descontoAplicado = calculateDiscount(saldoBase, regras.pix);
    return {
      saldoBase,
      descontoAplicado,
      taxaAplicada: 0,
      valorFinalPagamento: Math.max(saldoBase - descontoAplicado, 0),
      parcelas: 1,
      valorParcela: Math.max(saldoBase - descontoAplicado, 0),
    };
  }

  if (forma === "Dinheiro") {
    const descontoAplicado = calculateDiscount(saldoBase, regras.dinheiro);
    return {
      saldoBase,
      descontoAplicado,
      taxaAplicada: 0,
      valorFinalPagamento: Math.max(saldoBase - descontoAplicado, 0),
      parcelas: 1,
      valorParcela: Math.max(saldoBase - descontoAplicado, 0),
    };
  }

  if (forma === "Débito") {
    const descontoAplicado = calculateDiscount(saldoBase, regras.debito);
    return {
      saldoBase,
      descontoAplicado,
      taxaAplicada: 0,
      valorFinalPagamento: Math.max(saldoBase - descontoAplicado, 0),
      parcelas: 1,
      valorParcela: Math.max(saldoBase - descontoAplicado, 0),
    };
  }

  const shouldChargeInterest =
    regras.credito.repassarTaxaCliente &&
    selectedInstallments > regras.credito.parcelasSemJuros;
  const taxaAplicada = shouldChargeInterest
    ? (saldoBase * Math.max(regras.credito.taxaParcelamentoPercentual, 0)) / 100
    : 0;
  const valorFinalPagamento = saldoBase + taxaAplicada;

  return {
    saldoBase,
    descontoAplicado: 0,
    taxaAplicada,
    valorFinalPagamento,
    parcelas: selectedInstallments,
    valorParcela: selectedInstallments > 0 ? valorFinalPagamento / selectedInstallments : 0,
  };
}

function normalizeUsuario(usuario: UsuarioSistema): UsuarioSistema {
  const now = new Date().toISOString();

  return {
    ...usuario,
    id: usuario.id || createUsuarioId(),
    nome: usuario.nome || "Usuário sem nome",
    email: usuario.email || "",
    perfil: normalizeRole(usuario.perfil),
    status: usuario.status === "inativo" ? "inativo" : "ativo",
    criadoEm: usuario.criadoEm || now,
    atualizadoEm: usuario.atualizadoEm || now,
  };
}

export function getConfiguracoesOficina(): OficinaConfiguracoes {
  const storedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);

  if (!storedConfig) {
    return defaultOficinaConfiguracoes;
  }

  try {
    return normalizeConfig(JSON.parse(storedConfig) as OficinaConfiguracoes);
  } catch {
    return defaultOficinaConfiguracoes;
  }
}

export function saveConfiguracoesOficina(config: OficinaConfiguracoes) {
  const normalizedConfig = normalizeConfig(config);
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalizedConfig));
  return normalizedConfig;
}

export function getUsuarios(): UsuarioSistema[] {
  const storedUsuarios = localStorage.getItem(USERS_STORAGE_KEY);

  if (!storedUsuarios) {
    return [];
  }

  try {
    const parsedUsuarios = JSON.parse(storedUsuarios) as UsuarioSistema[];
    return Array.isArray(parsedUsuarios)
      ? parsedUsuarios.map(normalizeUsuario)
      : [];
  } catch {
    return [];
  }
}

function saveUsuarios(usuarios: UsuarioSistema[]) {
  localStorage.setItem(
    USERS_STORAGE_KEY,
    JSON.stringify(usuarios.map(normalizeUsuario)),
  );
}

export function saveUsuario(
  usuario: Omit<UsuarioSistema, "id" | "criadoEm" | "atualizadoEm">,
) {
  const now = new Date().toISOString();
  const newUsuario: UsuarioSistema = {
    ...usuario,
    id: createUsuarioId(),
    perfil: normalizeRole(usuario.perfil),
    status: usuario.status === "inativo" ? "inativo" : "ativo",
    criadoEm: now,
    atualizadoEm: now,
  };

  saveUsuarios([...getUsuarios(), newUsuario]);
  return newUsuario;
}

export function updateUsuario(usuario: UsuarioSistema) {
  const updatedUsuario = normalizeUsuario({
    ...usuario,
    atualizadoEm: new Date().toISOString(),
  });
  const updatedUsuarios = getUsuarios().map((currentUsuario) =>
    currentUsuario.id === usuario.id ? updatedUsuario : currentUsuario,
  );

  saveUsuarios(updatedUsuarios);
  return updatedUsuario;
}

export function deleteUsuario(usuarioId: string) {
  const updatedUsuarios = getUsuarios().filter(
    (usuario) => usuario.id !== usuarioId,
  );

  saveUsuarios(updatedUsuarios);
  return updatedUsuarios;
}
import { createSecureId } from "../../utils/ids";
