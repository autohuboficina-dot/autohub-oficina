export const LANCAMENTO_TIPOS = ["Entrada", "Saída"] as const;
export const LANCAMENTO_STATUS = ["Pendente", "Pago"] as const;
export const LANCAMENTO_CATEGORIAS = [
  "Peças",
  "Mão de obra",
  "Despesa fixa",
  "Taxa cartão",
  "Outros",
] as const;
export const LANCAMENTO_ORIGENS = ["OS", "Compra", "Manual"] as const;

export type LancamentoTipo = (typeof LANCAMENTO_TIPOS)[number];
export type LancamentoStatus = (typeof LANCAMENTO_STATUS)[number];
export type LancamentoCategoria = (typeof LANCAMENTO_CATEGORIAS)[number];
export type LancamentoOrigem = (typeof LANCAMENTO_ORIGENS)[number];

export type LancamentoFinanceiro = {
  id: string;
  tipo: LancamentoTipo;
  descricao: string;
  valor: number;
  data: string;
  status: LancamentoStatus;
  categoria: LancamentoCategoria;
  origem: LancamentoOrigem;
  origemId: string;
  criadoEm: string;
  atualizadoEm: string;
};

const STORAGE_KEY = "autohub:financeiro-lancamentos";

function createLancamentoId() {
  return `FIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function normalizeTipo(tipo: string): LancamentoTipo {
  return LANCAMENTO_TIPOS.includes(tipo as LancamentoTipo)
    ? (tipo as LancamentoTipo)
    : "Entrada";
}

function normalizeStatus(status: string): LancamentoStatus {
  return LANCAMENTO_STATUS.includes(status as LancamentoStatus)
    ? (status as LancamentoStatus)
    : "Pendente";
}

function normalizeCategoria(categoria: string): LancamentoCategoria {
  return LANCAMENTO_CATEGORIAS.includes(categoria as LancamentoCategoria)
    ? (categoria as LancamentoCategoria)
    : "Outros";
}

function normalizeOrigem(origem: string): LancamentoOrigem {
  return LANCAMENTO_ORIGENS.includes(origem as LancamentoOrigem)
    ? (origem as LancamentoOrigem)
    : "Manual";
}

function normalizeLancamento(
  lancamento: LancamentoFinanceiro,
): LancamentoFinanceiro {
  const now = new Date().toISOString();

  return {
    ...lancamento,
    id: lancamento.id || createLancamentoId(),
    tipo: normalizeTipo(lancamento.tipo),
    descricao: lancamento.descricao || "Lançamento sem descrição",
    valor: Number(lancamento.valor || 0),
    data: lancamento.data || now,
    status: normalizeStatus(lancamento.status),
    categoria: normalizeCategoria(lancamento.categoria),
    origem: normalizeOrigem(lancamento.origem),
    origemId: lancamento.origemId || "",
    criadoEm: lancamento.criadoEm || now,
    atualizadoEm: lancamento.atualizadoEm || now,
  };
}

function saveLancamentos(lancamentos: LancamentoFinanceiro[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(lancamentos.map(normalizeLancamento)),
  );
}

export function getLancamentos(): LancamentoFinanceiro[] {
  const storedLancamentos = localStorage.getItem(STORAGE_KEY);

  if (!storedLancamentos) {
    return [];
  }

  try {
    const parsedLancamentos = JSON.parse(
      storedLancamentos,
    ) as LancamentoFinanceiro[];
    return Array.isArray(parsedLancamentos)
      ? parsedLancamentos.map(normalizeLancamento)
      : [];
  } catch {
    return [];
  }
}

export function saveLancamento(
  lancamento: Omit<LancamentoFinanceiro, "id" | "criadoEm" | "atualizadoEm">,
) {
  const now = new Date().toISOString();
  const newLancamento: LancamentoFinanceiro = {
    ...lancamento,
    id: createLancamentoId(),
    valor: Number(lancamento.valor || 0),
    criadoEm: now,
    atualizadoEm: now,
  };

  saveLancamentos([newLancamento, ...getLancamentos()]);
  return newLancamento;
}

export function updateLancamento(lancamento: LancamentoFinanceiro) {
  const updatedLancamento = normalizeLancamento({
    ...lancamento,
    atualizadoEm: new Date().toISOString(),
  });
  const updatedLancamentos = getLancamentos().map((currentLancamento) =>
    currentLancamento.id === lancamento.id
      ? updatedLancamento
      : currentLancamento,
  );

  saveLancamentos(updatedLancamentos);
  return updatedLancamento;
}

export function deleteLancamento(lancamentoId: string) {
  const updatedLancamentos = getLancamentos().filter(
    (lancamento) => lancamento.id !== lancamentoId,
  );

  saveLancamentos(updatedLancamentos);
  return updatedLancamentos;
}
