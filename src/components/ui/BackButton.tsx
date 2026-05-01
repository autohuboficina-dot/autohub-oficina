import { useNavigate } from "react-router-dom";

type BackButtonProps = {
  fallbackPath?: string;
  className?: string;
};

export default function BackButton({
  fallbackPath = "/dashboard",
  className = "",
}: BackButtonProps) {
  const navigate = useNavigate();

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallbackPath);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 ${className}`}
    >
      <span aria-hidden="true">←</span>
      Voltar
    </button>
  );
}
