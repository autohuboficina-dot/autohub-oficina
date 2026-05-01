import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getBudgetApprovalBadgeClass,
  getBudgetApprovalLabel,
  getServiceOrderStatusBadgeClass,
  getServiceOrderStatusLabel,
  getServiceOrderStorageError,
  getStoredOrders,
  type ServiceOrder,
} from "../../services/osService";

export default function OSList() {
  const navigate = useNavigate();
  const [ordens, setOrdens] = useState<ServiceOrder[]>(() => getStoredOrders());
  const [storageError, setStorageError] = useState(() =>
    getServiceOrderStorageError(),
  );

  function reloadOrders() {
    setOrdens(getStoredOrders());
    setStorageError(getServiceOrderStorageError());
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">Ordens de Serviço</h2>

        <button
          onClick={() => navigate("/os/nova")}
          className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400"
        >
          Nova OS
        </button>
      </div>

      {storageError && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <p className="font-medium">{storageError}</p>
          <button
            type="button"
            onClick={reloadOrders}
            className="mt-3 rounded-lg border border-red-300/40 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/10"
          >
            Recarregar dados
          </button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="text-slate-400">
          <tr>
            <th className="text-left py-3">OS</th>
            <th className="text-left py-3">Cliente</th>
            <th className="text-left py-3">Veículo</th>
            <th className="text-left py-3">Status</th>
            <th className="text-left py-3">Orçamento</th>
            <th className="text-left py-3">Ação</th>
          </tr>
        </thead>

        <tbody>
          {ordens.map((os) => (
            <tr key={os.id} className="border-t border-slate-800">
              <td className="py-3 text-sky-400 font-medium">
                {os.codigo || os.id}
              </td>
              <td>{os.cliente}</td>
              <td className="text-slate-300">
                <span>{os.veiculo}</span>
                <span className="ml-2 text-xs text-slate-500">{os.placa}</span>
              </td>
              <td>
                <span className={getServiceOrderStatusBadgeClass(os.status)}>
                  {getServiceOrderStatusLabel(os.status)}
                </span>
              </td>
              <td>
                <span className={getBudgetApprovalBadgeClass(os.statusAprovacao)}>
                  {getBudgetApprovalLabel(os.statusAprovacao)}
                </span>
              </td>
              <td>
                <button
                  onClick={() => navigate(`/os/${os.codigo || os.id}`)}
                  className="bg-sky-500 px-3 py-1 rounded text-white hover:bg-sky-400"
                >
                  Ver detalhes
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
