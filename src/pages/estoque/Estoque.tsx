import { useMemo, useState } from "react";
import { getEstoque, type EstoqueItem, type EstoqueMovimentacao } from "./estoqueStorage";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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

function getLastMovement(item: EstoqueItem) {
  return [...item.historicoMovimentacao].sort(
    (firstMovement, secondMovement) =>
      new Date(secondMovement.data).getTime() -
      new Date(firstMovement.data).getTime(),
  )[0];
}

function getMovementBadgeClass(movement?: EstoqueMovimentacao) {
  if (movement?.tipo === "entrada") {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30";
  }

  if (movement?.tipo === "saida") {
    return "bg-red-500/15 text-red-200 ring-red-400/30";
  }

  return "bg-slate-700/70 text-slate-200 ring-slate-500/30";
}

export default function Estoque() {
  const [items] = useState<EstoqueItem[]>(() => getEstoque());
  const movements = useMemo(
    () =>
      items
        .flatMap((item) =>
          item.historicoMovimentacao.map((movement) => ({
            ...movement,
            itemNome: item.nome,
          })),
        )
        .sort(
          (firstMovement, secondMovement) =>
            new Date(secondMovement.data).getTime() -
            new Date(firstMovement.data).getTime(),
        ),
    [items],
  );
  const totalItems = items.length;
  const totalQuantity = items.reduce(
    (total, item) => total + Number(item.quantidade || 0),
    0,
  );
  const totalValue = items.reduce(
    (total, item) => total + item.quantidade * item.valorUnitario,
    0,
  );

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Estoque</h2>
          <p className="mt-2 text-slate-400">
            Controle automático de entradas por compras e saídas por uso na OS.
          </p>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-xs uppercase text-slate-500">Itens</span>
          <strong className="mt-2 block text-3xl text-white">{totalItems}</strong>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-xs uppercase text-slate-500">Quantidade</span>
          <strong className="mt-2 block text-3xl text-white">
            {totalQuantity}
          </strong>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-xs uppercase text-slate-500">
            Valor em estoque
          </span>
          <strong className="mt-2 block text-3xl text-sky-300">
            {formatCurrency(totalValue)}
          </strong>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
        <div className="mb-5">
          <h3 className="text-xl font-bold">Itens em estoque</h3>
          <p className="mt-1 text-sm text-slate-400">
            Valor médio é recalculado a cada entrada da mesma peça e fornecedor.
          </p>
        </div>

        {items.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Peça</th>
                  <th className="px-4 py-3 text-left">Quantidade</th>
                  <th className="px-4 py-3 text-left">Valor médio</th>
                  <th className="px-4 py-3 text-left">Fornecedor</th>
                  <th className="px-4 py-3 text-left">Última movimentação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const lastMovement = getLastMovement(item);

                  return (
                    <tr key={item.id} className="border-t border-slate-800">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-100">
                          {item.nome}
                        </p>
                        {item.osId && (
                          <p className="mt-1 text-xs text-slate-500">
                            Origem: {item.osId}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {item.quantidade}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatCurrency(item.valorUnitario)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {item.fornecedor}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${getMovementBadgeClass(
                            lastMovement,
                          )}`}
                        >
                          {lastMovement
                            ? `${lastMovement.tipo} · ${formatDate(lastMovement.data)}`
                            : "Sem movimentação"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            Nenhum item no estoque ainda. Ao confirmar uma compra com fornecedor,
            a entrada será registrada automaticamente.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
        <div className="mb-5">
          <h3 className="text-xl font-bold">Histórico de movimentação</h3>
          <p className="mt-1 text-sm text-slate-400">
            Entradas e saídas registradas automaticamente pelo fluxo de compras
            e OS.
          </p>
        </div>

        <div className="grid gap-3">
          {movements.length ? (
            movements.map((movement) => (
              <article
                key={movement.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">
                      {movement.itemNome}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {movement.descricao}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${getMovementBadgeClass(
                      movement,
                    )}`}
                  >
                    {movement.tipo}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-4">
                  <span>Qtd: {movement.quantidade}</span>
                  <span>Valor: {formatCurrency(movement.valorUnitario)}</span>
                  <span>OS: {movement.osId || "-"}</span>
                  <span>{formatDate(movement.data)}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
              Sem movimentações registradas.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
