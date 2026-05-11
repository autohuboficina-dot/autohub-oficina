import type { OficinaConfiguracoes } from "../services/configuracoesService";
import type { ServiceOrder } from "../services/osService";
import { formatPhone } from "../utils/formatters";

type ReceiptTotals = {
  laborTotal: number;
  partsTotal: number;
  discountAmount: number;
  finalTotal: number;
};

type ReciboOSProps = {
  order: ServiceOrder;
  oficina: OficinaConfiguracoes;
  totals: ReceiptTotals;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getVehicleDescription(order: ServiceOrder) {
  return [
    order.veiculoDados.marca || order.veiculoMarca,
    order.veiculoDados.modelo || order.veiculoModelo,
    order.veiculoDados.ano || order.veiculoAno,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function ReciboOS({ order, oficina, totals }: ReciboOSProps) {
  const clientName = order.clienteDados.nome || order.cliente || "-";
  const clientPhone =
    formatPhone(
      order.clienteDados.telefone || order.clienteTelefone || order.telefone,
    ) || "-";
  const vehicleDescription = getVehicleDescription(order) || order.veiculo || "-";
  const vehiclePlate =
    order.veiculoDados.placa || order.veiculoPlaca || order.placa || "-";
  const paymentMethod =
    order.formaPagamentoEscolhida || order.orcamento.formaPagamento || "";
  const shouldShowPartsTotal = totals.partsTotal > 0;
  const shouldShowDiscount = totals.discountAmount > 0;
  const hasCustomerProvidedParts = order.pecasNecessarias.some(
    (part) => part.peca_cliente,
  );

  return (
    <div className="recibo-print-area bg-white p-8 text-black">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }

            .recibo-print-area,
            .recibo-print-area * {
              visibility: visible;
            }

            .recibo-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0;
            }

            .no-print {
              display: none !important;
            }

            @page {
              margin: 16mm;
            }
          }
        `}
      </style>

      <div className="mx-auto max-w-4xl font-sans">
        <header className="border-b-2 border-black pb-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold uppercase">
                {oficina.nomeOficina}
              </h1>
              {oficina.whatsapp && (
                <p className="mt-1 text-sm">WhatsApp: {oficina.whatsapp}</p>
              )}
              {oficina.endereco && (
                <p className="mt-1 text-sm">Endereço: {oficina.endereco}</p>
              )}
            </div>

            <div className="text-right">
              <p className="text-xl font-bold uppercase">Recibo de serviço</p>
              <p className="mt-2 text-sm">OS: {order.codigo || order.id}</p>
              <p className="text-sm">Criada em: {formatDate(order.criadoEm)}</p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 border-b border-neutral-300 pb-5 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-bold uppercase">Dados do cliente</h2>
            <p className="mt-2">Nome: {clientName}</p>
            <p>Telefone: {clientPhone}</p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase">Dados do veículo</h2>
            <p className="mt-2">Veículo: {vehicleDescription}</p>
            <p>Placa: {vehiclePlate}</p>
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
              {order.servicosMaoDeObra.length > 0 ? (
                order.servicosMaoDeObra.map((service) => (
                  <tr key={service.id}>
                    <td className="border border-neutral-300 px-3 py-2">
                      {[service.servico, service.descricao]
                        .filter(Boolean)
                        .join(" - ")}
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
                  {formatCurrency(totals.laborTotal)}
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
              {order.pecasNecessarias.length > 0 ? (
                order.pecasNecessarias.map((part) => (
                  <tr key={part.id}>
                    <td className="border border-neutral-300 px-3 py-2">
                      {part.peca || "Peça sem descrição"}
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
              <strong>{formatCurrency(totals.laborTotal)}</strong>
            </div>
            {shouldShowPartsTotal && (
              <div className="flex justify-between border-b border-neutral-300 pb-1">
                <span>Total peças</span>
                <strong>{formatCurrency(totals.partsTotal)}</strong>
              </div>
            )}
            {shouldShowDiscount && (
              <div className="flex justify-between border-b border-neutral-300 pb-1">
                <span>Desconto</span>
                <strong>{formatCurrency(totals.discountAmount)}</strong>
              </div>
            )}
            <div className="flex justify-between border-2 border-black px-3 py-2 text-lg font-bold">
              <span>Total final</span>
              <span>{formatCurrency(totals.finalTotal)}</span>
            </div>
            {paymentMethod && <p>Forma de pagamento: {paymentMethod}</p>}
          </div>
        </section>

        <footer className="mt-12 text-center">
          {hasCustomerProvidedParts && (
            <p className="mb-5 text-left text-xs">
              * Peças marcadas como 'fornecidas pelo cliente' não possuem
              garantia da oficina.
            </p>
          )}
          <p className="font-semibold">Agradecemos a preferência!</p>
          <p className="mt-2 text-sm">
            Data de emissão do recibo: {formatDate(new Date().toISOString())}
          </p>
          <div className="mx-auto mt-14 w-72 border-t border-black pt-2 text-sm">
            Assinatura do cliente
          </div>
        </footer>
      </div>
    </div>
  );
}
