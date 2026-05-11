import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { supabase } from "../../lib/supabase";
import {
  getBudgetApprovalBadgeClass,
  getBudgetApprovalLabel,
  getServiceOrderStatusBadgeClass,
  getServiceOrderStatusLabel,
  getServiceOrderStorageError,
  getStoredOrders,
  getStoredOrdersSupabase,
  normalizeBudgetApprovalStatus,
  normalizeServiceOrderStatus,
  saveStoredOrders,
  type ServiceOrder,
} from "../../services/osService";

type SupabaseOrderStatusRow = {
  codigo: string;
  status: string | null;
  status_orcamento?: string | null;
  updated_at: string | null;
};

function normalizeSyncedBudgetStatus(status?: string | null) {
  return normalizeBudgetApprovalStatus((status || "pendente").toLowerCase());
}

async function syncOrdersStatusFromSupabase(orders: ServiceOrder[]) {
  if (!supabase || orders.length === 0) {
    return orders;
  }

  const codigos = orders.map((order) => order.codigo).filter(Boolean);

  if (!codigos.length) {
    return orders;
  }

  try {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("codigo, status, status_orcamento, updated_at")
      .in("codigo", codigos)
      .returns<SupabaseOrderStatusRow[]>();

    if (error || !data?.length) {
      return orders;
    }

    const statusByCode = new Map(data.map((row) => [row.codigo, row]));
    let hasUpdates = false;
    const updatedOrders = orders.map((order) => {
      const syncedRow = statusByCode.get(order.codigo);

      if (!syncedRow) {
        return order;
      }

      const syncedStatus = normalizeServiceOrderStatus(
        syncedRow.status || order.status,
      );
      const syncedBudgetStatus = syncedRow.status_orcamento
        ? normalizeSyncedBudgetStatus(syncedRow.status_orcamento)
        : order.statusAprovacao;
      const shouldUpdate =
        syncedStatus !== order.status ||
        syncedBudgetStatus !== order.statusAprovacao ||
        (syncedRow.updated_at && syncedRow.updated_at !== order.updatedAt);

      if (!shouldUpdate) {
        return order;
      }

      hasUpdates = true;
      return {
        ...order,
        status: syncedStatus,
        statusAprovacao: syncedBudgetStatus,
        updatedAt: syncedRow.updated_at || order.updatedAt,
      };
    });

    if (hasUpdates) {
      saveStoredOrders(updatedOrders);
    }

    return updatedOrders;
  } catch {
    return orders;
  }
}

export default function OSList() {
  const navigate = useNavigate();
  const { oficina_id } = useAuth();
  const [ordens, setOrdens] = useState<ServiceOrder[]>(() => getStoredOrders());
  const [storageError, setStorageError] = useState(() =>
    getServiceOrderStorageError(),
  );
  const [isLoadingOrders, setIsLoadingOrders] = useState(Boolean(oficina_id));

  async function reloadOrders() {
    setIsLoadingOrders(true);
    const loadedOrders = oficina_id
      ? await getStoredOrdersSupabase(oficina_id)
      : getStoredOrders();
    setOrdens(await syncOrdersStatusFromSupabase(loadedOrders));
    setStorageError(getServiceOrderStorageError());
    setIsLoadingOrders(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      const loadedOrders = oficina_id
        ? await getStoredOrdersSupabase(oficina_id)
        : getStoredOrders();
      const syncedOrders = await syncOrdersStatusFromSupabase(loadedOrders);

      if (isMounted) {
        setOrdens(syncedOrders);
        setStorageError(getServiceOrderStorageError());
        setIsLoadingOrders(false);
      }
    }

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, [oficina_id]);

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

      {isLoadingOrders && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
          Carregando ordens de serviço...
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
