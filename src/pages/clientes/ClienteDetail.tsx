import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getServiceOrderStatusBadgeClass,
  getStoredOrders,
} from "../os/osStorage";
import { getClientes } from "./clientesStorage";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const clientes = useMemo(() => getClientes(), []);
  const ordens = useMemo(() => getStoredOrders(), []);
  const cliente = useMemo(
    () => clientes.find((currentCliente) => currentCliente.id === id),
    [clientes, id],
  );
  const historicoOs = useMemo(() => {
    return ordens
      .filter((os) => os.clienteId === id)
      .sort(
        (a, b) =>
          new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
      );
  }, [id, ordens]);

  const totalGasto = historicoOs.reduce(
    (total, os) => total + os.orcamento.totalFinal,
    0,
  );
  const ultimaOs = historicoOs[0];
  const sectionClass =
    "rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6";
  const dataValueClass =
    "mt-1 overflow-hidden whitespace-normal break-words font-medium";

  if (!cliente) {
    return (
      <div>
        <button
          type="button"
          onClick={() => navigate("/clientes")}
          className="mb-6 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Voltar para clientes
        </button>

        <section className={sectionClass}>
          <h2 className="text-3xl font-bold">Cliente não encontrado</h2>
          <p className="mt-2 text-slate-400">
            Não existe cliente salvo para o ID informado.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">{cliente.nome}</h2>
          <p className="mt-2 text-slate-400">
            Histórico completo do cliente na oficina.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/clientes")}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Voltar
        </button>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-xs uppercase text-slate-500">Total de OS</span>
          <p className="mt-2 text-3xl font-bold text-sky-300">
            {historicoOs.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-xs uppercase text-slate-500">
            Valor total gasto
          </span>
          <p className="mt-2 text-3xl font-bold text-sky-300">
            {formatCurrency(totalGasto)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-xs uppercase text-slate-500">Última visita</span>
          <p className="mt-2 text-3xl font-bold text-sky-300">
            {ultimaOs?.id || "-"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {ultimaOs ? formatDate(ultimaOs.criadoEm) : "Sem histórico"}
          </p>
        </div>
      </section>

      <section className={`${sectionClass} mb-6`}>
        <h3 className="mb-5 text-xl font-semibold">Dados do cliente</h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">Tipo</span>
            <p className={dataValueClass}>{cliente.tipo}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">Nome</span>
            <p className={dataValueClass}>{cliente.nome || "-"}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">Telefone</span>
            <p className={dataValueClass}>{cliente.telefone || "-"}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">CPF/CNPJ</span>
            <p className={dataValueClass}>{cliente.documento || "-"}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">E-mail</span>
            <p className={dataValueClass}>{cliente.email || "-"}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs uppercase text-slate-500">Cidade</span>
            <p className={dataValueClass}>{cliente.cidade || "-"}</p>
          </div>
        </div>
      </section>

      <section className={`${sectionClass} mb-6`}>
        <h3 className="mb-5 text-xl font-semibold">Veículos do cliente</h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cliente.veiculos.map((veiculo) => (
            <div
              key={veiculo.id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <h4 className="font-semibold text-sky-300">
                {[veiculo.marca, veiculo.modelo, veiculo.ano]
                  .filter(Boolean)
                  .join(" ") || "Veículo sem identificação"}
              </h4>
              <p className="mt-2 text-sm text-slate-300">
                <strong>Placa:</strong> {veiculo.placa || "-"}
              </p>
            </div>
          ))}
        </div>

        {cliente.veiculos.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-slate-400">
            Nenhum veículo cadastrado para este cliente.
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <h3 className="mb-5 text-xl font-semibold">Histórico de OS</h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-3 text-left">OS</th>
                <th className="py-3 text-left">Veículo</th>
                <th className="py-3 text-left">Status</th>
                <th className="py-3 text-left">Valor</th>
                <th className="py-3 text-left">Data</th>
                <th className="py-3 text-left">Ação</th>
              </tr>
            </thead>

            <tbody>
              {historicoOs.map((os) => (
                <tr key={os.id} className="border-t border-slate-800">
                  <td className="py-3 font-medium text-sky-300">{os.id}</td>
                  <td className="text-slate-300">{os.veiculo || "-"}</td>
                  <td>
                    <span className={getServiceOrderStatusBadgeClass(os.status)}>
                      {os.status}
                    </span>
                  </td>
                  <td className="text-slate-300">
                    {formatCurrency(os.orcamento.totalFinal)}
                  </td>
                  <td className="text-slate-300">{formatDate(os.criadoEm)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => navigate(`/os/${os.id}`)}
                      className="rounded bg-sky-500 px-3 py-1 text-xs text-white hover:bg-sky-400"
                    >
                      Ver OS
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {historicoOs.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-slate-400">
            Nenhuma ordem de serviço vinculada a este cliente.
          </div>
        )}
      </section>
    </div>
  );
}
