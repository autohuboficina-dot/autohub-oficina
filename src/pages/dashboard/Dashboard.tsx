import { useLocation, useNavigate } from "react-router-dom";
import { ROLE_LABELS, type UserRole } from "../../accessControl";
import { getClientes } from "../../services/clientesService";
import { getCotacoes } from "../../services/cotacoesService";
import { getProdutosEstoque } from "../../services/estoqueService";
import { getStoredOrders } from "../../services/osService";

type DashboardProps = {
  role: UserRole;
};

type MetricCard = {
  label: string;
  value: string;
  hint: string;
  tone?: "sky" | "emerald" | "amber" | "red" | "violet";
  path?: string;
};

type DashboardLocationState = {
  welcomeMessage?: string;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function isRecent(value: string, days = 7) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return false;
  }

  const limit = new Date();
  limit.setDate(limit.getDate() - days);

  return date >= limit;
}

function getCardClass(tone: MetricCard["tone"] = "sky") {
  const classes = {
    sky: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    red: "border-red-400/20 bg-red-500/10 text-red-200",
    violet: "border-violet-400/20 bg-violet-500/10 text-violet-200",
  };

  return classes[tone];
}

function createMetrics(role: UserRole): MetricCard[] {
  const orders = getStoredOrders();
  const clientes = getClientes();
  const cotacoes = getCotacoes();
  const produtos = getProdutosEstoque();
  const openOrders = orders.filter(
    (order) => order.status !== "FINALIZADA" && order.status !== "CANCELADA",
  );
  const pendingBudgets = orders.filter(
    (order) =>
      order.statusAprovacao === "pendente" ||
      order.status === "AGUARDANDO_APROVACAO",
  );
  const receitaEstimada = orders.reduce(
    (total, order) => total + Number(order.orcamento.totalFinal || 0),
    0,
  );
  const comprasEmAberto = cotacoes.filter(
    (cotacao) =>
      cotacao.status !== "Compra confirmada com fornecedor" &&
      cotacao.status !== "Cancelada",
  );
  const estoqueBaixo = produtos.filter(
    (produto) => produto.estoque_atual <= produto.estoque_minimo,
  );
  const checklistPendente = orders.filter((order) =>
    order.checklistInicial.some((item) => !item.status),
  );
  const clientesRecentes = clientes.filter((cliente) =>
    isRecent(cliente.criadoEm),
  );
  const followUps = orders.filter(
    (order) =>
      order.status === "AGUARDANDO_APROVACAO" ||
      order.statusAprovacao === "pendente",
  );

  if (role === "mecanico") {
    return [
      {
        label: "Minhas OS",
        value: String(openOrders.length),
        hint: "OS abertas para execução",
        tone: "sky",
      },
      {
        label: "Em diagnóstico",
        value: String(
          orders.filter((order) => order.status === "EM_DIAGNOSTICO").length,
        ),
        hint: "Aguardando avaliação técnica",
        tone: "violet",
      },
      {
        label: "Aguardando peça",
        value: String(
          orders.filter((order) => order.status === "AGUARDANDO_PECA").length,
        ),
        hint: "Dependem de compras/estoque",
        tone: "amber",
      },
      {
        label: "Em execução",
        value: String(
          orders.filter((order) => order.status === "EM_EXECUCAO").length,
        ),
        hint: "Serviços em andamento",
        tone: "emerald",
      },
      {
        label: "Checklist pendente",
        value: String(checklistPendente.length),
        hint: "OS com checklist incompleto",
        tone: "red",
      },
    ];
  }

  if (role === "atendimento") {
    return [
      {
        label: "Novos clientes",
        value: String(clientesRecentes.length),
        hint: "Cadastrados nos últimos 7 dias",
        tone: "emerald",
      },
      {
        label: "Orçamentos pendentes",
        value: String(pendingBudgets.length),
        hint: "Aguardam resposta do cliente",
        tone: "amber",
      },
      {
        label: "Follow-ups Hermes",
        value: String(followUps.length),
        hint: "Oportunidades de contato",
        tone: "sky",
      },
      {
        label: "OS aguardando aprovação",
        value: String(
          orders.filter((order) => order.status === "AGUARDANDO_APROVACAO")
            .length,
        ),
        hint: "Prioridade do atendimento",
        tone: "violet",
      },
    ];
  }

  if (role === "compras") {
    return [
      {
        label: "Cotações abertas",
        value: String(
          cotacoes.filter((cotacao) => cotacao.status === "Cotação enviada")
            .length,
        ),
        hint: "Aguardam resposta",
        tone: "sky",
      },
      {
        label: "Respostas recebidas",
        value: String(
          cotacoes.filter((cotacao) => cotacao.status === "Resposta recebida")
            .length,
        ),
        hint: "Prontas para comparar",
        tone: "violet",
      },
      {
        label: "Compras aprovadas",
        value: String(
          cotacoes.filter(
            (cotacao) => cotacao.status === "Aprovada pelo cliente",
          ).length,
        ),
        hint: "Podem ser confirmadas",
        tone: "emerald",
      },
      {
        label: "ESTOQUE BAIXO",
        value: String(estoqueBaixo.length),
        hint: `${estoqueBaixo.length} produtos abaixo do mínimo`,
        tone: "red",
        path: "/estoque",
      },
    ];
  }

  if (role === "financeiro") {
    return [
      {
        label: "Receita estimada",
        value: formatCurrency(receitaEstimada),
        hint: "Total previsto em OS",
        tone: "emerald",
      },
      {
        label: "Orçamentos pendentes",
        value: String(pendingBudgets.length),
        hint: "Aguardam confirmação",
        tone: "amber",
      },
      {
        label: "Compras em aberto",
        value: String(comprasEmAberto.length),
        hint: "Ainda não confirmadas",
        tone: "violet",
      },
      {
        label: "OS finalizadas",
        value: String(
          orders.filter((order) => order.status === "FINALIZADA").length,
        ),
        hint: "Serviços encerrados",
        tone: "sky",
      },
    ];
  }

  return [
    {
      label: "OS abertas",
      value: String(openOrders.length),
      hint: "Em andamento no sistema",
      tone: "sky",
    },
    {
      label: "Orçamentos pendentes",
      value: String(pendingBudgets.length),
      hint: "Aguardam aprovação",
      tone: "amber",
    },
    {
      label: "Receita estimada",
      value: formatCurrency(receitaEstimada),
      hint: "Total previsto em OS",
      tone: "emerald",
    },
    {
      label: "Compras em aberto",
      value: String(comprasEmAberto.length),
      hint: "Ainda não confirmadas",
      tone: "violet",
    },
    {
      label: "ESTOQUE BAIXO",
      value: String(estoqueBaixo.length),
      hint: `${estoqueBaixo.length} produtos abaixo do mínimo`,
      tone: "red",
      path: "/estoque",
    },
    {
      label: "Clientes cadastrados",
      value: String(clientes.length),
      hint: "Base ativa no localStorage",
      tone: "sky",
    },
  ];
}

export default function Dashboard({ role }: DashboardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as DashboardLocationState | null;
  const metrics = createMetrics(role);

  return (
    <div className="max-w-6xl">
      {locationState?.welcomeMessage && (
        <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-100">
          {locationState.welcomeMessage}
        </div>
      )}

      <div className="mb-6">
        <span className="text-sm font-semibold uppercase text-sky-400">
          Dashboard {ROLE_LABELS[role]}
        </span>
        <h2 className="mt-1 text-3xl font-bold">Visão do perfil</h2>
        <p className="mt-2 text-slate-400">
          Indicadores rápidos calculados a partir dos dados salvos no navegador.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            onClick={() => metric.path && navigate(metric.path)}
            className={`rounded-2xl border p-5 shadow-sm shadow-slate-950/20 ${getCardClass(
              metric.tone,
            )} ${metric.path ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-red-300/50" : ""}`}
          >
            <span className="text-xs font-semibold uppercase opacity-80">
              {metric.label}
            </span>
            <strong className="mt-3 block text-3xl text-white">
              {metric.value}
            </strong>
            <p className="mt-2 text-sm text-slate-300">{metric.hint}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
