import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../../components/ui/BackButton";
import {
  getCotacoes,
  getPublicCotacaoSupabase,
  submitPublicCotacaoResponseSupabase,
  type CotacaoPeca,
} from "../../services/cotacoesService";
import { getConfiguracoesOficina } from "../../services/configuracoesService";
import {
  getStoredOrders,
  saveStoredOrders,
  updateServiceOrderStatusWithTimeline,
} from "../../services/osService";

type PieceResponseFormState = {
  preco: string;
  marca: string;
  observacaoFornecedor: string;
};

function createEmptyPieceResponse(): PieceResponseFormState {
  return {
    preco: "",
    marca: "",
    observacaoFornecedor: "",
  };
}

function createInitialResponses(cotacao?: CotacaoPeca) {
  return (cotacao?.pecas || []).reduce<Record<string, PieceResponseFormState>>(
    (responses, part) => ({
      ...responses,
      [part.id]: createEmptyPieceResponse(),
    }),
    {},
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getVehicleText(cotacao: CotacaoPeca) {
  return (
    [
      cotacao.veiculo.marca,
      cotacao.veiculo.modelo,
      cotacao.veiculo.ano,
      cotacao.veiculo.motor,
      cotacao.veiculo.combustivel,
      cotacao.veiculo.placa,
      cotacao.veiculo.chassi,
    ]
      .filter(Boolean)
      .join(" · ") || "Veículo não informado"
  );
}

export default function FornecedorCotacaoView() {
  const { id } = useParams();
  const [cotacoes, setCotacoes] = useState<CotacaoPeca[]>(() => getCotacoes());
  const [oficinaConfig] = useState(() => getConfiguracoesOficina());
  const [responsesByPiece, setResponsesByPiece] = useState<
    Record<string, PieceResponseFormState>
  >(() => createInitialResponses(getCotacoes().find((item) => item.id === id)));
  const [feedback, setFeedback] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cotacao = useMemo(
    () => cotacoes.find((currentCotacao) => currentCotacao.id === id),
    [cotacoes, id],
  );
  const oficinaNome =
    cotacao?.oficinaNome || oficinaConfig.nomeOficina || "Oficina";

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";

  useEffect(() => {
    let isMounted = true;

    async function loadCotacao() {
      if (!id) {
        return;
      }

      const loadedCotacao = await getPublicCotacaoSupabase(id);

      if (!isMounted || !loadedCotacao) {
        return;
      }

      setCotacoes((currentCotacoes) =>
        currentCotacoes.some((currentCotacao) => currentCotacao.id === loadedCotacao.id)
          ? currentCotacoes.map((currentCotacao) =>
              currentCotacao.id === loadedCotacao.id ? loadedCotacao : currentCotacao,
            )
          : [loadedCotacao, ...currentCotacoes],
      );
      setResponsesByPiece(createInitialResponses(loadedCotacao));
      if (loadedCotacao.responses.length > 0) {
        setIsSubmitted(true);
        setFeedback("Resposta enviada com sucesso. Obrigado!");
      }
    }

    void loadCotacao();

    return () => {
      isMounted = false;
    };
  }, [id]);

  function updatePieceResponse(
    pieceId: string,
    field: keyof PieceResponseFormState,
    value: string,
  ) {
    setResponsesByPiece((currentResponses) => ({
      ...currentResponses,
      [pieceId]: {
        ...(currentResponses[pieceId] || createEmptyPieceResponse()),
        [field]: value,
      },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cotacao || isSubmitting) {
      return;
    }

    const itemResponses = cotacao.pecas.map((part) => {
      const response = responsesByPiece[part.id] || createEmptyPieceResponse();
      const dataHora = new Date().toISOString();

      return {
        pecaId: part.id,
        nomePeca: part.peca,
        quantidade: part.quantidade,
        preco: Number(response.preco || 0),
        marca: response.marca.trim(),
        observacaoFornecedor: response.observacaoFornecedor.trim(),
        dataHora,
      };
    });

    const missingPrice = itemResponses.some((response) => response.preco <= 0);

    if (missingPrice) {
      setFeedback("Informe o preço de todas as peças antes de enviar.");
      return;
    }

    setIsSubmitting(true);
    setFeedback("");

    try {
      const updatedCotacao = await submitPublicCotacaoResponseSupabase(
        cotacao,
        itemResponses,
      );

      if (cotacao.osId) {
        const updatedOrders = getStoredOrders().map((order) =>
          order.id === cotacao.osId || order.codigo === cotacao.osId
            ? updateServiceOrderStatusWithTimeline(order, "COTACAO_RECEBIDA", {
                tipo: "resposta_fornecedor",
                titulo: "Resposta de fornecedor recebida",
                descricao: `${cotacao.fornecedorNome} respondeu a cotação ${cotacao.id}.`,
                usuarioResponsavel: "Fornecedor",
              })
            : order,
        );
        saveStoredOrders(updatedOrders);
      }

      setCotacoes((currentCotacoes) =>
        currentCotacoes.map((currentCotacao) =>
          currentCotacao.id === cotacao.id ? updatedCotacao : currentCotacao,
        ),
      );
      setIsSubmitted(true);
      setFeedback("Resposta enviada com sucesso. Obrigado!");
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a resposta. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!cotacao) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center">
        <section className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <BackButton className="mb-6" />
          <h1 className="text-3xl font-bold">Cotação não encontrada</h1>
          <p className="mt-2 text-slate-400">
            Confira se o link enviado pela oficina está correto.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <BackButton />

      <header className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <span className="text-sm font-semibold uppercase text-sky-400">
          Cotação {cotacao.id}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Responder cotação de peças
        </h1>
        <p className="mt-3 text-slate-300">
          Olá, {cotacao.fornecedorNome}. Informe as condições comerciais de cada
          peça solicitada.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">Oficina</span>
            <p className="mt-1 font-semibold text-slate-100">{oficinaNome}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">
              Cliente da oficina
            </span>
            <p className="mt-1 font-semibold text-slate-100">
              {cotacao.clienteNome || "Cliente não informado"}
            </p>
          </div>
        </div>
      </header>

      {feedback && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-emerald-100">
          {feedback}
        </section>
      )}

      {isSubmitted && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold text-emerald-300">
            Resposta registrada
          </h2>
          <p className="mt-2 text-slate-300">
            Resposta enviada com sucesso. Obrigado!
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="grid gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">Veículo</span>
            <p className="mt-1 font-semibold text-slate-100">
              {getVehicleText(cotacao)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              OS: {cotacao.osId || "Avulsa"} · Enviada em{" "}
              {formatDate(cotacao.enviadaEm)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">
              Peças solicitadas
            </span>
            <div className="mt-3 grid gap-2">
              {cotacao.pecas.map((part) => (
                <div
                  key={part.id}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300"
                >
                  <strong className="text-slate-100">{part.peca}</strong> ·
                  Quantidade: {part.quantidade}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {cotacao.fotos.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold text-sky-300">Fotos técnicas</h2>
          <p className="mt-1 text-sm text-slate-400">
            Imagens liberadas pela oficina para apoiar a identificação das peças.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {cotacao.fotos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.titulo}
                  className="h-44 w-full object-cover"
                />
                <figcaption className="p-4 text-sm text-slate-400">
                  <strong className="block text-slate-100">{photo.titulo}</strong>
                  {photo.tipo}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {!isSubmitted && (
      <form
        className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
        onSubmit={handleSubmit}
      >
        <h2 className="text-xl font-bold text-sky-300">Resposta por peça</h2>

        <div className="mt-5 grid gap-5">
          {cotacao.pecas.map((part) => {
            const response =
              responsesByPiece[part.id] || createEmptyPieceResponse();

            return (
              <section
                key={part.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="mb-4">
                  <h3 className="font-semibold text-slate-100">{part.peca}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Quantidade solicitada: {part.quantidade}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Preço unitário</label>
                    <input
                      className={inputClass}
                      min="0"
                      step="0.01"
                      type="number"
                      value={response.preco}
                      onChange={(event) =>
                        updatePieceResponse(part.id, "preco", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Marca</label>
                    <input
                      className={inputClass}
                      value={response.marca}
                      onChange={(event) =>
                        updatePieceResponse(part.id, "marca", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Total da peça</label>
                    <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100">
                      {formatCurrency(Number(response.preco || 0) * part.quantidade)}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass}>Observação opcional</label>
                    <input
                      className={inputClass}
                      placeholder="Observação"
                      value={response.observacaoFornecedor}
                      onChange={(event) =>
                        updatePieceResponse(
                          part.id,
                          "observacaoFornecedor",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            Total informado:{" "}
            {formatCurrency(
              cotacao.pecas.reduce((total, part) => {
                const response =
                  responsesByPiece[part.id] || createEmptyPieceResponse();
                return total + Number(response.preco || 0) * part.quantidade;
              }, 0),
            )}
          </p>

          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Enviar resposta
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
