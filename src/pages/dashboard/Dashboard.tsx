import { ROLE_LABELS, type UserRole } from "../../accessControl";
import { getClientes } from "../clientes/clientesStorage";
import { getCotacoes } from "../compras/comprasStorage";
import { getEstoque } from "../estoque/estoqueStorage";
import { getStoredOrders } from "../os/osStorage";

type DashboardProps = {
  role: UserRole;
};

type MetricCard = {
  label: string;
  value: string;
  hint: string;
  tone?: "sky" | "emerald" | "amber" | "red" | "violet";
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
  const estoque = getEstoque();
  const openOrders = orders.filter(
    (order) => order.status !== "Finalizado" && order.status !== "Cancelado",
  );
  const pendingBudgets = orders.filter(
    (order) =>
      order.statusAprovacao === "pendente" ||
      order.status === "Aguardando aprovação",
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
  const estoqueBaixo = estoque.filter((item) => item.quantidade <= 1);
  const checklistPendente = orders.filter((order) =>
    order.checklistInicial.some((item) => !item.status),
  );
  const clientesRecentes = clientes.filter((cliente) =>
    isRecent(cliente.criadoEm),
  );
  const followUps = orders.filter(
    (order) =>
      order.status === "Aguardando aprovação" ||
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
          orders.filter((order) => order.status === "Em diagnóstico").length,
        ),
        hint: "Aguardando avaliação técnica",
        tone: "violet",
      },
      {
        label: "Aguardando peça",
        value: String(
          orders.filter((order) => order.status === "Aguardando peça").length,
        ),
        hint: "Dependem de compras/estoque",
        tone: "amber",
      },
      {
        label: "Em execução",
        value: String(
          orders.filter((order) => order.status === "Em execução").length,
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
        label: "Follow-ups SDR",
        value: String(followUps.length),
        hint: "Oportunidades de contato",
        tone: "sky",
      },
      {
        label: "OS aguardando aprovação",
        value: String(
          orders.filter((order) => order.status === "Aguardando aprovação")
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
        label: "Estoque baixo",
        value: String(estoqueBaixo.length),
        hint: "Itens com 1 unidade ou menos",
        tone: "red",
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
          orders.filter((order) => order.status === "Finalizado").length,
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
      label: "Estoque baixo",
      value: String(estoqueBaixo.length),
      hint: "Itens com 1 unidade ou menos",
      tone: "red",
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
  const metrics = createMetrics(role);

  return (
    <div className="max-w-6xl">
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
            className={`rounded-2xl border p-5 shadow-sm shadow-slate-950/20 ${getCardClass(
              metric.tone,
            )}`}
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
