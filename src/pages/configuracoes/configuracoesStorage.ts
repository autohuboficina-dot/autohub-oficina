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
};

function createUsuarioId() {
  return `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function normalizeConfig(config: Partial<OficinaConfiguracoes>): OficinaConfiguracoes {
  return {
    ...defaultOficinaConfiguracoes,
    ...config,
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
