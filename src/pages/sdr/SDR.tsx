import { useMemo, useState } from "react";
import { formatPhone, onlyDigits } from "../../utils/formatters";
import { getClientes, type Cliente } from "../../services/clientesService";
import { getConfiguracoesOficina } from "../../services/configuracoesService";
import { getStoredOrders, type ServiceOrder } from "../../services/osService";

const RECENT_OS_LIMIT = 5;
const OLD_OS_DAYS = 90;

function getWhatsAppPhone(value: string) {
  const digits = onlyDigits(value);

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function openWhatsApp(phone: string, message: string) {
  const whatsappPhone = getWhatsAppPhone(phone);

  if (!whatsappPhone) {
    return false;
  }

  window.open(
    `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer",
  );
  return true;
}

function createBudgetLink(publicToken: string) {
  if (typeof window === "undefined") {
    return `/orcamento/${publicToken}`;
  }

  return `${window.location.origin}/orcamento/${publicToken}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getDaysSince(value: string) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return 0;
  }

  const diff = Date.now() - date.getTime();
  return Math.max(Math.floor(diff / (1000 * 60 * 60 * 24)), 0);
}

function sortOrdersByDate(orders: ServiceOrder[]) {
  return [...orders].sort((a, b) => {
    return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
  });
}

function getOrderClientKeys(order: ServiceOrder) {
  return [
    order.clienteId,
    onlyDigits(order.clienteTelefone || order.telefone),
    order.clienteNome || order.cliente,
  ].filter(Boolean);
}

function getClientKeys(cliente: Cliente) {
  return [cliente.id, onlyDigits(cliente.telefone), cliente.nome].filter(Boolean);
}

export default function SDR() {
  const [feedback, setFeedback] = useState("");
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const clientes = useMemo(() => getClientes(), []);
  const orders = useMemo(() => getStoredOrders(), []);

  const sortedOrders = useMemo(() => sortOrdersByDate(orders), [orders]);
  const pendingBudgets = useMemo(
    () => sortedOrders.filter((order) => order.status === "AGUARDANDO_APROVACAO"),
    [sortedOrders],
  );
  const clientsWithoutReturn = useMemo(() => {
    const recentClientKeys = new Set(
      sortedOrders.slice(0, RECENT_OS_LIMIT).flatMap(getOrderClientKeys),
    );

    return clientes.filter((cliente) => {
      return !getClientKeys(cliente).some((key) => recentClientKeys.has(key));
    });
  }, [clientes, sortedOrders]);
  const oldOrders = useMemo(
    () =>
      sortedOrders.filter((order) => {
        return getDaysSince(order.criadoEm) >= OLD_OS_DAYS;
      }),
    [sortedOrders],
  );

  function handleWhatsApp(phone: string, message: string, successMessage: string) {
    const opened = openWhatsApp(phone, message);
    setFeedback(
      opened
        ? successMessage
        : "Não encontrei telefone válido para abrir o WhatsApp.",
    );
  }

  function sendBudgetReminder(order: ServiceOrder) {
    const link = createBudgetLink(order.orcamento.publicToken || order.id);
    handleWhatsApp(
      order.clienteTelefone || order.telefone,
      `Olá, ${order.cliente}. Aqui é da ${oficinaConfig.nomeOficina}. Seu orçamento da OS ${order.id} ainda está aguardando aprovação. Você pode visualizar e responder por aqui: ${link}`,
      `Lembrete de orçamento preparado para ${order.cliente}.`,
    );
  }

  function contactClient(cliente: Cliente) {
    handleWhatsApp(
      cliente.telefone,
      `Olá, ${cliente.nome}. Tudo bem? Aqui é da ${oficinaConfig.nomeOficina}. Passando para saber se precisa de algum apoio com seu veículo ou deseja agendar uma avaliação.`,
      `Contato preparado para ${cliente.nome}.`,
    );
  }

  function remindReview(order: ServiceOrder) {
    handleWhatsApp(
      order.clienteTelefone || order.telefone,
      `Olá, ${order.cliente}. Aqui é da ${oficinaConfig.nomeOficina}. Já faz um tempo desde a OS ${order.id} do seu ${order.veiculo}. Podemos agendar uma revisão preventiva?`,
      `Lembrete de revisão preparado para ${order.cliente}.`,
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Ações sugeridas</h2>
          <p className="mt-2 text-slate-400">
            SDR simples para acompanhar orçamentos, retornos e revisões com
            mensagens rápidas por WhatsApp.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          <span className="font-semibold text-sky-300">{orders.length}</span> OS
          analisadas
        </div>
      </div>

      {feedback && (
        <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {feedback}
        </div>
      )}

      <div className="grid gap-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold uppercase text-amber-300">
                Orçamentos pendentes
              </span>
              <h3 className="mt-1 text-xl font-bold">
                OS aguardando aprovação
              </h3>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-200 ring-1 ring-amber-400/30">
              {pendingBudgets.length} pendente(s)
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendingBudgets.length ? (
              pendingBudgets.map((order) => (
                <article
                  key={order.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-100">
                        {order.cliente}
                      </h4>
                      <p className="text-sm text-slate-400">
                        {order.id} · {order.veiculo}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-200">
                      {formatDate(order.criadoEm)}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-slate-400">
                    {order.servicoInicial || "Orçamento aguardando retorno."}
                  </p>

                  <button
                    type="button"
                    onClick={() => sendBudgetReminder(order)}
                    className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                  >
                    Enviar lembrete
                  </button>
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                Nenhum orçamento pendente no momento.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold uppercase text-sky-300">
                Clientes sem retorno
              </span>
              <h3 className="mt-1 text-xl font-bold">
                Fora das últimas {RECENT_OS_LIMIT} OS
              </h3>
            </div>
            <span className="rounded-full bg-sky-500/15 px-3 py-1 text-sm font-medium text-sky-200 ring-1 ring-sky-400/30">
              {clientsWithoutReturn.length} cliente(s)
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clientsWithoutReturn.length ? (
              clientsWithoutReturn.map((cliente) => (
                <article
                  key={cliente.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <h4 className="font-semibold text-slate-100">{cliente.nome}</h4>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatPhone(cliente.telefone) || "Sem telefone"} ·{" "}
                    {cliente.cidade || "Cidade não informada"}
                  </p>
                  <p className="mt-3 text-sm text-slate-500">
                    {cliente.quantidadeVeiculos} veículo(s) cadastrado(s)
                  </p>

                  <button
                    type="button"
                    onClick={() => contactClient(cliente)}
                    className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                  >
                    Entrar em contato
                  </button>
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                Todos os clientes aparecem nas últimas OS ou ainda não há clientes
                cadastrados.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold uppercase text-violet-300">
                Revisões sugeridas
              </span>
              <h3 className="mt-1 text-xl font-bold">
                OS com mais de {OLD_OS_DAYS} dias
              </h3>
            </div>
            <span className="rounded-full bg-violet-500/15 px-3 py-1 text-sm font-medium text-violet-200 ring-1 ring-violet-400/30">
              {oldOrders.length} revisão(ões)
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {oldOrders.length ? (
              oldOrders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-100">
                        {order.cliente}
                      </h4>
                      <p className="text-sm text-slate-400">
                        {order.veiculo} · {order.placa || "Sem placa"}
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-500/15 px-2 py-1 text-xs text-violet-200">
                      {getDaysSince(order.criadoEm)} dias
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-500">
                    Última OS: {order.id} em {formatDate(order.criadoEm)}
                  </p>

                  <button
                    type="button"
                    onClick={() => remindReview(order)}
                    className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                  >
                    Lembrar cliente
                  </button>
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                Nenhuma OS antiga o suficiente para sugerir revisão.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
