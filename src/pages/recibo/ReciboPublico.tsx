import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { formatPhone } from "../../utils/formatters";

type PublicReceiptService = {
  id?: string | number;
  servico?: string | null;
  descricao?: string | null;
  valor?: number | null;
};

type PublicReceiptPart = {
  id?: string | number;
  peca?: string | null;
  nome?: string | null;
  nome_peca?: string | null;
  quantidade?: number | null;
  peca_cliente?: boolean | null;
};

type PublicReceiptData = {
  oficina?: {
    nome?: string | null;
    nome_oficina?: string | null;
    whatsapp?: string | null;
    endereco?: string | null;
  } | null;
  cliente?: {
    nome?: string | null;
    telefone?: string | null;
  } | null;
  veiculo?: {
    marca?: string | null;
    modelo?: string | null;
    ano?: string | null;
    placa?: string | null;
  } | null;
  os?: {
    codigo?: string | null;
    criado_em?: string | null;
    criadoEm?: string | null;
    km_entrada?: string | number | null;
    proxima_revisao_km?: string | number | null;
    proxima_revisao_data?: string | null;
    observacoes_tecnicas?: string | null;
  } | null;
  servicos?: PublicReceiptService[] | null;
  pecas?: PublicReceiptPart[] | null;
  totais?: {
    total_mao_de_obra?: number | null;
    total_final?: number | null;
  } | null;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatNumber(value?: string | number | null) {
  const numberValue = Number(value || 0);

  if (!numberValue) {
    return "";
  }

  return new Intl.NumberFormat("pt-BR").format(numberValue);
}

function getPartName(part: PublicReceiptPart) {
  return part.peca || part.nome || part.nome_peca || "Peça sem descrição";
}

export default function ReciboPublico() {
  const { token = "" } = useParams();
  const [receipt, setReceipt] = useState<PublicReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadReceipt() {
      if (!supabase || !token) {
        if (isMounted) {
          setReceipt(null);
          setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase.rpc("public_get_recibo", {
        p_recibo_token: token,
      });

      if (isMounted) {
        setReceipt((data as PublicReceiptData | null) ?? null);
        setIsLoading(false);
      }
    }

    void loadReceipt();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const vehicleDescription = useMemo(() => {
    if (!receipt?.veiculo) {
      return "-";
    }

    return (
      [receipt.veiculo.marca, receipt.veiculo.modelo, receipt.veiculo.ano]
        .filter(Boolean)
        .join(" ") || "-"
    );
  }, [receipt]);
  const services = receipt?.servicos ?? [];
  const parts = receipt?.pecas ?? [];
  const laborTotal =
    Number(receipt?.totais?.total_mao_de_obra ?? 0) ||
    services.reduce((total, service) => total + Number(service.valor || 0), 0);
  const finalTotal = Number(receipt?.totais?.total_final ?? laborTotal);
  const entryKm = formatNumber(receipt?.os?.km_entrada);
  const nextReviewKm = formatNumber(receipt?.os?.proxima_revisao_km);
  const nextReviewDate = receipt?.os?.proxima_revisao_data
    ? formatDate(receipt.os.proxima_revisao_data)
    : "";
  const nextReviewText = [nextReviewKm ? `${nextReviewKm} km` : "", nextReviewDate]
    .filter(Boolean)
    .join(" ou ");
  const hasCustomerProvidedParts = parts.some((part) => part.peca_cliente);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <p className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">
          Carregando recibo...
        </p>
      </main>
    );
  }

  if (!receipt) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <p className="max-w-lg rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center text-sm text-red-100">
          Recibo não encontrado ou expirado.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-xl font-bold text-sky-300">AutoHub Oficina</p>
        </header>

        <div className="bg-white p-8 text-black">
          <div className="mx-auto max-w-4xl font-sans">
            <header className="border-b-2 border-black pb-5">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <h1 className="text-2xl font-bold uppercase">
                    {receipt.oficina?.nome || receipt.oficina?.nome_oficina || "Oficina"}
                  </h1>
                  {receipt.oficina?.whatsapp && (
                    <p className="mt-1 text-sm">
                      WhatsApp: {receipt.oficina.whatsapp}
                    </p>
                  )}
                  {receipt.oficina?.endereco && (
                    <p className="mt-1 text-sm">
                      Endereço: {receipt.oficina.endereco}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold uppercase">Recibo de serviço</p>
                  <p className="mt-2 text-sm">
                    OS: {receipt.os?.codigo || "-"}
                  </p>
                  <p className="text-sm">
                    Criada em:{" "}
                    {formatDate(receipt.os?.criado_em || receipt.os?.criadoEm)}
                  </p>
                </div>
              </div>
            </header>

            <section className="mt-6 grid gap-4 border-b border-neutral-300 pb-5 md:grid-cols-2">
              <div>
                <h2 className="text-sm font-bold uppercase">Dados do cliente</h2>
                <p className="mt-2">Nome: {receipt.cliente?.nome || "-"}</p>
                <p>
                  Telefone:{" "}
                  {formatPhone(receipt.cliente?.telefone || "") || "-"}
                </p>
              </div>

              <div>
                <h2 className="text-sm font-bold uppercase">Dados do veículo</h2>
                <p className="mt-2">Veículo: {vehicleDescription}</p>
                <p>Placa: {receipt.veiculo?.placa || "-"}</p>
                {entryKm && <p>KM de entrada: {entryKm} km</p>}
              </div>
            </section>

            <section className="mt-6">
              <h2 className="text-sm font-bold uppercase">Serviços realizados</h2>
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-neutral-400 px-3 py-2 text-left">
                      Descrição do serviço
                    </th>
                    <th className="w-40 border border-neutral-400 px-3 py-2 text-right">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {services.length ? (
                    services.map((service, index) => (
                      <tr key={service.id ?? index}>
                        <td className="border border-neutral-300 px-3 py-2">
                          {[service.servico, service.descricao]
                            .filter(Boolean)
                            .join(" - ") || "Serviço"}
                        </td>
                        <td className="border border-neutral-300 px-3 py-2 text-right">
                          {formatCurrency(Number(service.valor || 0))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="border border-neutral-300 px-3 py-2" colSpan={2}>
                        Nenhum serviço detalhado.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border border-neutral-400 px-3 py-2 text-right font-bold">
                      Subtotal mão de obra
                    </td>
                    <td className="border border-neutral-400 px-3 py-2 text-right font-bold">
                      {formatCurrency(laborTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>

            <section className="mt-6">
              <h2 className="text-sm font-bold uppercase">Peças utilizadas</h2>
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-neutral-400 px-3 py-2 text-left">
                      Nome da peça
                    </th>
                    <th className="w-32 border border-neutral-400 px-3 py-2 text-right">
                      Quantidade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parts.length ? (
                    parts.map((part, index) => (
                      <tr key={part.id ?? index}>
                        <td className="border border-neutral-300 px-3 py-2">
                          {getPartName(part)}
                          {part.peca_cliente ? " (fornecida pelo cliente)" : ""}
                        </td>
                        <td className="border border-neutral-300 px-3 py-2 text-right">
                          {Number(part.quantidade || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="border border-neutral-300 px-3 py-2" colSpan={2}>
                        Nenhuma peça utilizada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="mt-6 ml-auto w-full max-w-sm">
              <h2 className="text-sm font-bold uppercase">Resumo financeiro</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between border-b border-neutral-300 pb-1">
                  <span>Total mão de obra</span>
                  <strong>{formatCurrency(laborTotal)}</strong>
                </div>
                <div className="flex justify-between border-2 border-black px-3 py-2 text-lg font-bold">
                  <span>Total final</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </section>

            {receipt.os?.observacoes_tecnicas && (
              <section className="mt-6 border-t border-neutral-300 pt-5">
                <h2 className="text-sm font-bold uppercase">Observações técnicas</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {receipt.os.observacoes_tecnicas}
                </p>
              </section>
            )}

            <footer className="mt-12 text-center">
              {nextReviewText && (
                <p className="mb-5 text-sm">
                  Próxima revisão recomendada: {nextReviewText}
                </p>
              )}
              {hasCustomerProvidedParts && (
                <p className="mb-5 text-left text-xs">
                  * Peças marcadas como 'fornecidas pelo cliente' não possuem
                  garantia da oficina.
                </p>
              )}
              <p className="font-semibold">Agradecemos a preferência!</p>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
