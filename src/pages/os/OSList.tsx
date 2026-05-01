import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getBudgetApprovalBadgeClass,
  getBudgetApprovalLabel,
  getServiceOrderStatusBadgeClass,
  getStoredOrders,
  type ServiceOrder,
} from "./osStorage";

export default function OSList() {
  const navigate = useNavigate();
  const [ordens, setOrdens] = useState<ServiceOrder[]>([]);

  useEffect(() => {
    setOrdens(getStoredOrders());
  }, []);

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
              <td className="py-3 text-sky-400 font-medium">{os.id}</td>
              <td>{os.cliente}</td>
              <td className="text-slate-300">
                <span>{os.veiculo}</span>
                <span className="ml-2 text-xs text-slate-500">{os.placa}</span>
              </td>
              <td>
                <span className={getServiceOrderStatusBadgeClass(os.status)}>
                  {os.status}
                </span>
              </td>
              <td>
                <span className={getBudgetApprovalBadgeClass(os.statusAprovacao)}>
                  {getBudgetApprovalLabel(os.statusAprovacao)}
                </span>
              </td>
              <td>
                <button
                  onClick={() => navigate(`/os/${os.id}`)}
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
