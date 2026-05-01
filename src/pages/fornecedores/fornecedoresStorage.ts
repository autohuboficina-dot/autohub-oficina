export const FORNECEDOR_CATEGORIAS = [
  "Peças",
  "Pneus",
  "Óleo e lubrificantes",
  "Elétrica",
  "Funilaria",
  "Serviços terceirizados",
  "Outros",
] as const;

export type FornecedorCategoria = (typeof FORNECEDOR_CATEGORIAS)[number];

export type Fornecedor = {
  id: string;
  nome: string;
  whatsapp: string;
  categoria: FornecedorCategoria;
  observacoes: string;
  criadoEm: string;
  atualizadoEm: string;
};

const STORAGE_KEY = "autohub:fornecedores";

function createFornecedorId() {
  return `FOR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function normalizeCategoria(categoria: string): FornecedorCategoria {
  if (FORNECEDOR_CATEGORIAS.includes(categoria as FornecedorCategoria)) {
    return categoria as FornecedorCategoria;
  }

  return "Outros";
}

function normalizeFornecedor(fornecedor: Fornecedor): Fornecedor {
  const now = new Date().toISOString();

  return {
    ...fornecedor,
    id: fornecedor.id || createFornecedorId(),
    nome: fornecedor.nome || "Fornecedor sem nome",
    whatsapp: fornecedor.whatsapp || "",
    categoria: normalizeCategoria(fornecedor.categoria),
    observacoes: fornecedor.observacoes || "",
    criadoEm: fornecedor.criadoEm || now,
    atualizadoEm: fornecedor.atualizadoEm || now,
  };
}

export function getFornecedores(): Fornecedor[] {
  const storedFornecedores = localStorage.getItem(STORAGE_KEY);

  if (!storedFornecedores) {
    return [];
  }

  try {
    const parsedFornecedores = JSON.parse(storedFornecedores) as Fornecedor[];
    return Array.isArray(parsedFornecedores)
      ? parsedFornecedores.map(normalizeFornecedor)
      : [];
  } catch {
    return [];
  }
}

function saveFornecedores(fornecedores: Fornecedor[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fornecedores));
}

export function saveFornecedor(
  fornecedor: Omit<Fornecedor, "id" | "criadoEm" | "atualizadoEm">,
) {
  const now = new Date().toISOString();
  const newFornecedor: Fornecedor = {
    ...fornecedor,
    id: createFornecedorId(),
    categoria: normalizeCategoria(fornecedor.categoria),
    criadoEm: now,
    atualizadoEm: now,
  };

  saveFornecedores([...getFornecedores(), newFornecedor]);
  return newFornecedor;
}

export function updateFornecedor(fornecedor: Fornecedor) {
  const updatedFornecedor: Fornecedor = {
    ...fornecedor,
    categoria: normalizeCategoria(fornecedor.categoria),
    atualizadoEm: new Date().toISOString(),
  };
  const fornecedores = getFornecedores().map((currentFornecedor) =>
    currentFornecedor.id === fornecedor.id ? updatedFornecedor : currentFornecedor,
  );

  saveFornecedores(fornecedores);
  return updatedFornecedor;
}

export function deleteFornecedor(fornecedorId: string) {
  saveFornecedores(
    getFornecedores().filter((fornecedor) => fornecedor.id !== fornecedorId),
  );
}
