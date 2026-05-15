import { useMemo, useState, type FormEvent } from "react";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { formatPhone, onlyDigits } from "../../utils/formatters";
import {
  FORNECEDOR_CATEGORIAS,
  deleteFornecedor,
  getFornecedores,
  saveFornecedor,
  updateFornecedor,
  type Fornecedor,
  type FornecedorCategoria,
} from "../../services/fornecedoresService";

type FornecedorFormState = {
  nome: string;
  whatsapp: string;
  categoria: FornecedorCategoria;
  observacoes: string;
};

const initialFormState: FornecedorFormState = {
  nome: "",
  whatsapp: "",
  categoria: "Peças",
  observacoes: "",
};

export default function Fornecedores() {
  const toast = useToast();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(() =>
    getFornecedores(),
  );
  const [formState, setFormState] =
    useState<FornecedorFormState>(initialFormState);
  const [editingFornecedorId, setEditingFornecedorId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");

  const filteredFornecedores = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return fornecedores;
    }

    return fornecedores.filter((fornecedor) => {
      return [
        fornecedor.nome,
        fornecedor.whatsapp,
        fornecedor.categoria,
        fornecedor.observacoes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [fornecedores, search]);

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500";
  const labelClass = "mb-2 block text-sm font-medium text-slate-300";

  function resetForm() {
    setFormState(initialFormState);
    setEditingFornecedorId("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.nome.trim()) {
      setFeedback("Informe o nome do fornecedor.");
      return;
    }

    if (editingFornecedorId) {
      const currentFornecedor = fornecedores.find(
        (fornecedor) => fornecedor.id === editingFornecedorId,
      );

      if (!currentFornecedor) {
        return;
      }

        updateFornecedor({
          ...currentFornecedor,
          nome: formState.nome.trim(),
          whatsapp: onlyDigits(formState.whatsapp),
          categoria: formState.categoria,
          observacoes: formState.observacoes.trim(),
        });
      setFeedback("Fornecedor atualizado.");
    } else {
      saveFornecedor({
        nome: formState.nome.trim(),
        whatsapp: onlyDigits(formState.whatsapp),
        categoria: formState.categoria,
        observacoes: formState.observacoes.trim(),
      });
      setFeedback("Fornecedor cadastrado.");
    }

    setFornecedores(getFornecedores());
    resetForm();
    toast.success("Fornecedor salvo!");
  }

  function handleEditFornecedor(fornecedor: Fornecedor) {
    setEditingFornecedorId(fornecedor.id);
    setFormState({
      nome: fornecedor.nome,
      whatsapp: formatPhone(fornecedor.whatsapp),
      categoria: fornecedor.categoria,
      observacoes: fornecedor.observacoes,
    });
    setFeedback("");
  }

  function handleDeleteFornecedor(fornecedorId: string) {
    deleteFornecedor(fornecedorId);
    setFornecedores(getFornecedores());
    setFeedback("Fornecedor excluído.");
    toast.success("Fornecedor excluído.");

    if (editingFornecedorId === fornecedorId) {
      resetForm();
    }
  }

  const { execute: executeSubmitFornecedor, loading: savingFornecedor } =
    useAsyncAction(handleSubmit, {
      errorMessage: "Erro ao salvar fornecedor",
    });
  const { execute: executeDeleteFornecedor, loading: deletingFornecedor } =
    useAsyncAction(async (fornecedorId: string) => {
      handleDeleteFornecedor(fornecedorId);
    }, {
      errorMessage: "Erro ao excluir fornecedor",
    });

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Fornecedores</h2>
          <p className="mt-2 text-slate-400">
            Cadastre contatos de compra para solicitar cotações por WhatsApp.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          <span className="font-semibold text-sky-300">{fornecedores.length}</span>{" "}
          fornecedor(es)
        </div>
      </div>

      {feedback && (
        <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {feedback}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
        <h3 className="text-xl font-bold">
          {editingFornecedorId ? "Editar fornecedor" : "Novo fornecedor"}
        </h3>

        <form
          className="mt-5 grid gap-5 lg:grid-cols-2"
          onSubmit={(event) => {
            void executeSubmitFornecedor(event);
          }}
        >
          <div>
            <label className={labelClass}>Nome</label>
            <input
              className={inputClass}
              placeholder="Distribuidora de peças"
              value={formState.nome}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  nome: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>WhatsApp</label>
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              value={formState.whatsapp}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  whatsapp: formatPhone(event.target.value),
                }))
              }
            />
          </div>

          <div>
            <label className={labelClass}>Categoria</label>
            <select
              className={inputClass}
              value={formState.categoria}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  categoria: event.target.value as FornecedorCategoria,
                }))
              }
            >
              {FORNECEDOR_CATEGORIAS.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Observações</label>
            <input
              className={inputClass}
              placeholder="Prazo, marcas atendidas, condições..."
              value={formState.observacoes}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  observacoes: event.target.value,
                }))
              }
            />
          </div>

          <div className="flex flex-wrap gap-3 lg:col-span-2">
            <button
              type="submit"
              disabled={savingFornecedor}
              className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingFornecedor
                ? "Salvando..."
                : editingFornecedorId
                  ? "Salvar alterações"
                  : "Salvar fornecedor"}
            </button>

            {editingFornecedorId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/20 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-xl font-bold">Lista de fornecedores</h3>

          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none transition focus:border-sky-500 sm:max-w-xs"
            placeholder="Buscar fornecedor"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">WhatsApp</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>

            <tbody>
              {filteredFornecedores.length ? (
                filteredFornecedores.map((fornecedor) => (
                  <tr key={fornecedor.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100">{fornecedor.nome}</p>
                      {fornecedor.observacoes && (
                        <p className="mt-1 text-xs text-slate-500">
                          {fornecedor.observacoes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatPhone(fornecedor.whatsapp) || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">
                        {fornecedor.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditFornecedor(fornecedor)}
                          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => void executeDeleteFornecedor(fornecedor.id)}
                          disabled={deletingFornecedor}
                          className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingFornecedor ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    Nenhum fornecedor encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
