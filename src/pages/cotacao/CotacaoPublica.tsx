import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { supabase } from "../../lib/supabase";

type CotacaoStatus = "COTACAO_ENVIADA" | string;

type PublicCotacaoItem = {
  id: string;
  nome_peca?: string | null;
  nome?: string | null;
  peca?: string | null;
  quantidade?: number | null;
};

type PublicCotacaoData = {
  id: string;
  status: CotacaoStatus;
  enviada_em?: string | null;
  oficina?: { nome?: string | null } | null;
  fornecedor?: { nome?: string | null } | null;
  veiculo?: {
    marca?: string | null;
    modelo?: string | null;
    ano?: string | null;
    placa?: string | null;
  } | null;
  itens?: PublicCotacaoItem[] | null;
};

type ItemResponseForm = {
  cotacaoItemId: string;
  preco: string;
  marca: string;
  observacao: string;
  indisponivel: boolean;
};

type PageStatus = "loading" | "error" | "answered" | "ready" | "sent";

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getItemName(item: PublicCotacaoItem) {
  return item.nome_peca || item.nome || item.peca || "Peça não informada";
}

export default function CotacaoPublica() {
  const { cotacaoId = "" } = useParams();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [cotacao, setCotacao] = useState<PublicCotacaoData | null>(null);
  const [responses, setResponses] = useState<ItemResponseForm[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCotacao() {
      if (!supabase || !cotacaoId) {
        if (isMounted) {
          setStatus("error");
        }
        return;
      }

      const { data, error } = await supabase.rpc("public_get_cotacao", {
        p_cotacao_id: cotacaoId,
      });

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        setStatus("error");
        return;
      }

      const loadedCotacao = data as PublicCotacaoData;

      if (loadedCotacao.status !== "COTACAO_ENVIADA") {
        setCotacao(loadedCotacao);
        setStatus("answered");
        return;
      }

      setCotacao(loadedCotacao);
      setResponses(
        (loadedCotacao.itens ?? []).map((item) => ({
          cotacaoItemId: item.id,
          preco: "",
          marca: "",
          observacao: "",
          indisponivel: false,
        })),
      );
      setStatus("ready");
    }

    void loadCotacao();

    return () => {
      isMounted = false;
    };
  }, [cotacaoId]);

  const vehicleDescription = useMemo(() => {
    if (!cotacao?.veiculo) {
      return "Veículo não informado";
    }

    return (
      [
        cotacao.veiculo.marca,
        cotacao.veiculo.modelo,
        cotacao.veiculo.ano,
        cotacao.veiculo.placa ? `Placa ${cotacao.veiculo.placa}` : "",
      ]
        .filter(Boolean)
        .join(" ") || "Veículo não informado"
    );
  }, [cotacao]);

  function updateResponse(
    cotacaoItemId: string,
    field: keyof Omit<ItemResponseForm, "cotacaoItemId">,
    value: string | boolean,
  ) {
    setResponses((currentResponses) =>
      currentResponses.map((response) =>
        response.cotacaoItemId === cotacaoItemId
          ? {
              ...response,
              [field]: value,
              ...(field === "indisponivel" && value === true
                ? { preco: "", marca: "", observacao: "Item indisponível" }
                : {}),
            }
          : response,
      ),
    );
  }

  async function handleSubmit() {
    setErrorMessage("");

    if (!supabase || !cotacaoId) {
      setStatus("error");
      throw new Error("Esta solicitação não foi encontrada.");
    }

    const invalidItem = responses.some(
      (response) =>
        !response.indisponivel && Number(response.preco || 0) <= 0,
    );

    if (invalidItem) {
      setErrorMessage(
        "Informe o preço de todos os itens ou marque como indisponível.",
      );
      throw new Error("Informe o preço de todos os itens ou marque como indisponível.");
    }

    const items = responses.map((response) => ({
      cotacao_item_id: response.cotacaoItemId,
      preco_unitario: response.indisponivel ? 0 : Number(response.preco || 0),
      marca: response.indisponivel ? "" : response.marca.trim(),
      observacao: response.indisponivel
        ? "Item indisponível"
        : response.observacao.trim(),
    }));

    const { error } = await supabase.rpc("public_submit_cotacao_response", {
      p_cotacao_id: cotacaoId,
      p_items: items,
    });

    if (error) {
      setErrorMessage("Não foi possível enviar a cotação. Tente novamente.");
      throw new Error("Erro ao enviar");
    }

    setStatus("sent");
  }

  const { execute: executeSubmitQuote, loading: isSubmitting } = useAsyncAction(
    handleSubmit,
    {
      successMessage: "Cotação enviada!",
      errorMessage: "Erro ao enviar",
      onError: (error) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Erro ao enviar",
        );
      },
    },
  );

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <p className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">
          Carregando solicitação de cotação...
        </p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <p className="max-w-lg rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center text-sm text-red-100">
          Esta solicitação não foi encontrada ou já foi encerrada.
        </p>
      </main>
    );
  }

  if (status === "answered") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <p className="max-w-lg rounded-2xl border border-sky-400/30 bg-sky-500/10 p-6 text-center text-sm text-sky-100">
          Você já enviou sua resposta para esta cotação.
        </p>
      </main>
    );
  }

  if (status === "sent") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <p className="max-w-lg rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center text-sm text-emerald-100">
          Cotação enviada com sucesso! A oficina receberá sua resposta.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <p className="text-xl font-bold text-sky-300">AutoHub Oficina</p>
          <p className="mt-2 text-sm text-slate-400">
            Solicitação pública de cotação
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <h1 className="text-2xl font-bold">Dados da solicitação</h1>
          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-xs uppercase text-slate-500">Oficina</span>
              <p className="mt-1 font-semibold text-slate-100">
                {cotacao?.oficina?.nome || "Oficina"}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-slate-500">
                Fornecedor
              </span>
              <p className="mt-1 font-semibold text-slate-100">
                {cotacao?.fornecedor?.nome || "Fornecedor"}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-slate-500">Veículo</span>
              <p className="mt-1 font-semibold text-slate-100">
                {vehicleDescription}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-slate-500">
                Data de envio
              </span>
              <p className="mt-1 font-semibold text-slate-100">
                {formatDate(cotacao?.enviada_em)}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Itens para cotar</h2>
          <div className="mt-5 grid gap-4">
            {(cotacao?.itens ?? []).map((item) => {
              const response = responses.find(
                (currentResponse) => currentResponse.cotacaoItemId === item.id,
              );

              if (!response) {
                return null;
              }

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-100">
                        {getItemName(item)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Quantidade solicitada: {Number(item.quantidade || 1)}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-amber-100">
                      <input
                        type="checkbox"
                        checked={response.indisponivel}
                        onChange={(event) =>
                          updateResponse(
                            item.id,
                            "indisponivel",
                            event.target.checked,
                          )
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-amber-500"
                      />
                      Não tenho este item
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr_1.4fr]">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Preço unitário
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={response.indisponivel}
                        value={response.preco}
                        onChange={(event) =>
                          updateResponse(item.id, "preco", event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Marca
                      </label>
                      <input
                        disabled={response.indisponivel}
                        value={response.marca}
                        onChange={(event) =>
                          updateResponse(item.id, "marca", event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Observação
                      </label>
                      <input
                        disabled={response.indisponivel}
                        value={response.observacao}
                        onChange={(event) =>
                          updateResponse(
                            item.id,
                            "observacao",
                            event.target.value,
                          )
                        }
                        placeholder="Prazo, disponibilidade, frete..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void executeSubmitQuote()}
            disabled={isSubmitting}
            className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Enviando..." : "Enviar cotação"}
          </button>
        </div>
      </div>
    </main>
  );
}
