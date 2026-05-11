import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  Lightbulb,
  Sparkles,
  Target,
} from "lucide-react";

type StoredOrder = {
  status?: string;
  statusOrcamento?: string;
  statusAprovacao?: string;
  updatedAt?: string;
  createdAt?: string;
  criadoEm?: string;
  orcamento?: {
    totalFinal?: number;
    total_final?: number;
  };
  total_final?: number;
};

type StoredCliente = {
  id?: string;
};

type OficinaConfig = {
  nomeOficina?: string;
};

type HermesResult = {
  resumo?: string;
  alertas?: string[];
  insights?: string[];
  recomendacoes?: string[];
};

type OficinaMetrics = {
  nomeOficina: string;
  totalOS: number;
  osAbertas: number;
  osParadas: number;
  orcamentosPendentes: number;
  orcamentosAprovados: number;
  orcamentosRecusados: number;
  taxaAprovacao: number;
  totalClientes: number;
  receitaEstimada: number;
};

const closedStatuses = ["FINALIZADA", "ENTREGUE", "CANCELADA"];

function safeParseArray<T>(key: string): T[] {
  try {
    const parsedValue = JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function safeParseObject<T>(key: string): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as T;
  } catch {
    return {} as T;
  }
}

function getOrderBudgetStatus(order: StoredOrder) {
  return order.statusOrcamento || order.statusAprovacao || "";
}

function getOrderTotal(order: StoredOrder) {
  return Number(
    order.orcamento?.total_final ??
      order.orcamento?.totalFinal ??
      order.total_final ??
      0,
  );
}

function collectMetrics(): OficinaMetrics {
  const ordens = safeParseArray<StoredOrder>("autohub:service-orders");
  const clientes = safeParseArray<StoredCliente>("autohub:clientes");
  const config = safeParseObject<OficinaConfig>("autohub:configuracoes-oficina");
  const nomeOficina = config.nomeOficina ?? "sua oficina";
  const osAbertas = ordens.filter(
    (order) => !closedStatuses.includes(order.status || ""),
  ).length;
  const osParadas = ordens.filter((order) => {
    if (closedStatuses.includes(order.status || "")) {
      return false;
    }

    const referenceDate = new Date(
      order.updatedAt ?? order.createdAt ?? order.criadoEm ?? "",
    );

    if (Number.isNaN(referenceDate.getTime())) {
      return false;
    }

    const dias = Math.floor((Date.now() - referenceDate.getTime()) / 86400000);
    return dias >= 3;
  }).length;
  const orcamentosPendentes = ordens.filter(
    (order) => getOrderBudgetStatus(order) === "PENDENTE",
  ).length;
  const orcamentosAprovados = ordens.filter((order) =>
    ["APROVADO", "APROVADA", "confirmado_oficina", "pre_aprovado"].includes(
      getOrderBudgetStatus(order),
    ),
  ).length;
  const orcamentosRecusados = ordens.filter((order) =>
    ["RECUSADO", "recusado"].includes(getOrderBudgetStatus(order)),
  ).length;
  const decidedBudgets = orcamentosAprovados + orcamentosRecusados;
  const taxaAprovacao =
    decidedBudgets > 0 ? (orcamentosAprovados / decidedBudgets) * 100 : 0;
  const receitaEstimada = ordens
    .filter((order) =>
      ["APROVADO", "APROVADA", "confirmado_oficina", "pre_aprovado"].includes(
        getOrderBudgetStatus(order),
      ),
    )
    .reduce((total, order) => total + getOrderTotal(order), 0);

  return {
    nomeOficina,
    totalOS: ordens.length,
    osAbertas,
    osParadas,
    orcamentosPendentes,
    orcamentosAprovados,
    orcamentosRecusados,
    taxaAprovacao,
    totalClientes: clientes.length,
    receitaEstimada,
  };
}

function createHermesPrompt(metrics: OficinaMetrics) {
  return `Você é o Hermes, assistente de inteligência da oficina mecânica "${metrics.nomeOficina}".
Analise os dados abaixo e responda em português brasileiro de forma direta e prática,
como um consultor experiente falando com o dono da oficina.

DADOS DA OFICINA:
- Total de OS no sistema: ${metrics.totalOS}
- OS em andamento: ${metrics.osAbertas}
- OS paradas há 3+ dias sem atualização: ${metrics.osParadas}
- Orçamentos aguardando aprovação: ${metrics.orcamentosPendentes}
- Orçamentos aprovados: ${metrics.orcamentosAprovados}
- Orçamentos recusados: ${metrics.orcamentosRecusados}
- Taxa de aprovação: ${metrics.taxaAprovacao.toFixed(1)}%
- Total de clientes cadastrados: ${metrics.totalClientes}
- Receita estimada em OS aprovadas: R$ ${metrics.receitaEstimada.toFixed(2)}

Responda EXATAMENTE neste formato JSON, sem markdown, sem explicação extra:
{
  "resumo": "Uma frase resumindo a situação geral da oficina hoje",
  "alertas": [
    "alerta 1 específico e acionável",
    "alerta 2 específico e acionável"
  ],
  "insights": [
    "insight 1 baseado nos dados",
    "insight 2 baseado nos dados"
  ],
  "recomendacoes": [
    "recomendação 1 prática e direta",
    "recomendação 2 prática e direta"
  ]
}

Se não houver dados suficientes para um item, omita esse item do JSON.
Máximo 3 itens por array. Seja direto, sem enrolação.`;
}

function normalizeList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 3)
    : [];
}

function parseHermesResult(text: string): HermesResult {
  const parsedValue = JSON.parse(text) as HermesResult;

  return {
    resumo: typeof parsedValue.resumo === "string" ? parsedValue.resumo : "",
    alertas: normalizeList(parsedValue.alertas),
    insights: normalizeList(parsedValue.insights),
    recomendacoes: normalizeList(parsedValue.recomendacoes),
  };
}

function formatAnalysisDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function ResultList({
  items,
  fallback,
}: {
  items: string[];
  fallback: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-slate-300">{fallback}</p>;
  }

  return (
    <ul className="space-y-3 text-sm text-slate-200">
      {items.map((item) => (
        <li key={item} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function SDR() {
  const [result, setResult] = useState<HermesResult | null>(null);
  const [rawResponse, setRawResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysisDate, setAnalysisDate] = useState<Date | null>(null);
  const metrics = useMemo(() => collectMetrics(), []);
  const hasData = metrics.totalOS > 0;

  async function analyzeWorkshop() {
    setErrorMessage("");
    setRawResponse("");
    setResult(null);

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      setErrorMessage("Hermes não está configurado. Entre em contato com o suporte.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: createHermesPrompt(metrics),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("Anthropic request failed");
      }

      const data = (await response.json()) as {
        content?: Array<{ text?: string }>;
      };
      const texto = data.content?.[0]?.text ?? "";

      try {
        setResult(parseHermesResult(texto));
      } catch {
        setRawResponse(texto || "Hermes respondeu, mas sem conteúdo legível.");
      }

      setAnalysisDate(new Date());
    } catch {
      setErrorMessage("Não foi possível conectar ao Hermes. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-3xl font-bold">Hermes</h2>
              <p className="mt-1 text-slate-400">
                Assistente IA da sua oficina
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          <span className="font-semibold text-sky-300">{metrics.totalOS}</span>{" "}
          OS no sistema
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
        <div className="flex gap-4">
          <Brain className="mt-1 h-6 w-6 shrink-0 text-sky-200" aria-hidden="true" />
          <p className="text-slate-200">
            Hermes analisa os dados da sua oficina e sugere ações para você não
            perder dinheiro, não esquecer OS e crescer com mais controle.
          </p>
        </div>
      </section>

      {!hasData && (
        <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Cadastre clientes e abra OS para o Hermes ter dados para analisar.
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        onClick={() => void analyzeWorkshop()}
        disabled={!hasData || isLoading}
        className="mb-6 inline-flex items-center gap-3 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {isLoading
          ? "Hermes está analisando sua oficina..."
          : "Analisar minha oficina agora"}
      </button>

      {rawResponse && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
          <h3 className="text-xl font-bold">Resposta do Hermes</h3>
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">
            {rawResponse}
          </p>
        </section>
      )}

      {result && (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Activity className="h-5 w-5 text-sky-200" aria-hidden="true" />
                <h3 className="text-xl font-bold">Situação da oficina</h3>
              </div>
              <p className="text-sm text-slate-200">
                {result.resumo || "Sem resumo disponível."}
              </p>
            </article>

            <article className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
              <div className="mb-4 flex items-center gap-3">
                <AlertTriangle
                  className="h-5 w-5 text-amber-200"
                  aria-hidden="true"
                />
                <h3 className="text-xl font-bold">Alertas — requer atenção</h3>
              </div>
              <ResultList
                items={result.alertas || []}
                fallback="Nenhum alerta crítico no momento"
              />
            </article>

            <article className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Lightbulb className="h-5 w-5 text-sky-200" aria-hidden="true" />
                <h3 className="text-xl font-bold">Insights</h3>
              </div>
              <ResultList
                items={result.insights || []}
                fallback="Sem insights suficientes por enquanto."
              />
            </article>

            <article className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Target className="h-5 w-5 text-emerald-200" aria-hidden="true" />
                <h3 className="text-xl font-bold">Recomendações</h3>
              </div>
              <ResultList
                items={result.recomendacoes || []}
                fallback="Sem recomendações suficientes por enquanto."
              />
            </article>
          </div>

          <footer className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
            {analysisDate && (
              <p>Análise gerada em {formatAnalysisDate(analysisDate)}</p>
            )}
            <button
              type="button"
              onClick={() => void analyzeWorkshop()}
              disabled={isLoading}
              className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Atualizar análise
            </button>
            <p className="mt-4 text-xs text-slate-500">
              Hermes analisa os dados salvos localmente. Os resultados são
              sugestões — a decisão final é sempre sua.
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
