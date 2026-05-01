import { useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { getCotacoes, updateCotacao, type CotacaoPeca } from "../compras/comprasStorage";

type SupplierFormState = {
  preco: string;
  prazo: string;
  marca: string;
  observacao: string;
};

const initialFormState: SupplierFormState = {
  preco: "",
  prazo: "",
  marca: "",
  observacao: "",
};

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

function getVehicleText(cotacao: CotacaoPeca) {
  return (
    [
      cotacao.veiculo.marca,
      cotacao.veiculo.modelo,
      cotacao.veiculo.ano,
      cotacao.veiculo.motor,
      cotacao.veiculo.placa,
    ]
      .filter(Boolean)
      .join(" · ") || "Veículo não informado"
  );
}

export default function FornecedorCotacaoView() {
  const { id } = useParams();
  const [cotacoes, setCotacoes] = useState<CotacaoPeca[]>(() => getCotacoes());
  const [form, setForm] = useState<SupplierFormState>(initialFormState);
  const [feedback, setFeedback] = useState("");

  const cotacao = useMemo(
    () => cotacoes.find((currentCotacao) => currentCotacao.id === id),
    [cotacoes, id],
  );

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cotacao) {
      return;
    }

    const preco = Number(form.preco || 0);

    if (!preco || preco <= 0) {
      setFeedback("Informe um preço válido para responder a cotação.");
      return;
    }

    const updatedCotacao = updateCotacao({
      ...cotacao,
      status:
        cotacao.status === "Cotação enviada"
          ? "Resposta recebida"
          : cotacao.status,
      responses: [
        ...cotacao.responses,
        {
          fornecedorId: cotacao.fornecedorId,
          fornecedorNome: cotacao.fornecedorNome,
          preco,
          prazo: form.prazo.trim(),
          marca: form.marca.trim(),
          observacao: form.observacao.trim(),
          dataResposta: new Date().toISOString(),
        },
      ],
    });

    setCotacoes((currentCotacoes) =>
      currentCotacoes.map((currentCotacao) =>
        currentCotacao.id === cotacao.id ? updatedCotacao : currentCotacao,
      ),
    );
    setForm(initialFormState);
    setFeedback("Resposta enviada com sucesso. Obrigado!");
  }

  if (!cotacao) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center">
        <section className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-3xl font-bold">Cotação não encontrada</h1>
          <p className="mt-2 text-slate-400">
            Confira se o link enviado pela oficina está correto.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <header className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <span className="text-sm font-semibold uppercase text-sky-400">
          Cotação {cotacao.id}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Responder cotação de peça
        </h1>
        <p className="mt-3 text-slate-300">
          Olá, {cotacao.fornecedorNome}. Envie preço, prazo, marca e observação
          para a oficina comparar as opções.
        </p>
      </header>

      {feedback && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-emerald-100">
          {feedback}
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">Peça</span>
            <p className="mt-1 font-semibold text-slate-100">{cotacao.peca}</p>
            <p className="mt-1 text-sm text-slate-400">
              Quantidade: {cotacao.quantidade} · Urgência: {cotacao.urgencia}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">Veículo</span>
            <p className="mt-1 font-semibold text-slate-100">
              {getVehicleText(cotacao)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              OS: {cotacao.osId || "Avulsa"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:col-span-2">
            <span className="text-xs uppercase text-slate-500">Observações</span>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
              {cotacao.observacao || "Sem observações adicionais."}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Solicitado em {formatDate(cotacao.enviadaEm)}
            </p>
          </div>
        </div>
      </section>

      <form
        className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
        onSubmit={handleSubmit}
      >
        <h2 className="text-xl font-bold text-sky-300">Sua resposta</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Preço</label>
            <input
              className={inputClass}
              min="0"
              step="0.01"
              type="number"
              value={form.preco}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  preco: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Prazo</label>
            <input
              className={inputClass}
              placeholder="Ex: 2 dias"
              value={form.prazo}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  prazo: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Marca da peça</label>
            <input
              className={inputClass}
              value={form.marca}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  marca: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Observação</label>
            <input
              className={inputClass}
              placeholder="Disponibilidade, frete, condição..."
              value={form.observacao}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  observacao: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Enviar resposta
          </button>
        </div>
      </form>
    </div>
  );
}
