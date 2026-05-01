import { useState } from "react";
import {
  SERVICE_ORDER_PHOTO_TYPES,
  SERVICE_ORDER_PHOTO_VISIBILITIES,
  type ServiceOrderPhoto,
  type ServiceOrderPhotoType,
  type ServiceOrderPhotoVisibility,
} from "../../services/osService";
import { createSecureId } from "../../utils/ids";

const MAX_PHOTOS_PER_ORDER = 5;
const MAX_PHOTO_SIZE_BYTES = 1024 * 1024;

type ServiceOrderPhotosSectionProps = {
  photos: ServiceOrderPhoto[];
  onChange: (photos: ServiceOrderPhoto[]) => void;
  sectionClass: string;
  labelClass: string;
  inputClass: string;
};

function createPhotoId() {
  return createSecureId("foto");
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ServiceOrderPhotosSection({
  photos,
  onChange,
  sectionClass,
  labelClass,
  inputClass,
}: ServiceOrderPhotosSectionProps) {
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    const selectedFiles = Array.from(files || []);

    if (!selectedFiles.length) {
      return;
    }

    setError("");

    if (photos.length + selectedFiles.length > MAX_PHOTOS_PER_ORDER) {
      setError("Limite de 5 fotos por OS. Remova uma foto antes de adicionar outra.");
      return;
    }

    const oversizedFile = selectedFiles.find(
      (file) => file.size > MAX_PHOTO_SIZE_BYTES,
    );

    if (oversizedFile) {
      setError(`A foto ${oversizedFile.name} ultrapassa o limite de 1MB.`);
      return;
    }

    const nextPhotos = await Promise.all(
      selectedFiles.map(async (file) => ({
        id: createPhotoId(),
        titulo: file.name.replace(/\.[^.]+$/, "") || file.name,
        tipo: "problema" as ServiceOrderPhotoType,
        visibilidade: "Ambos" as ServiceOrderPhotoVisibility,
        dataUrl: await readFileAsDataUrl(file),
        criadoEm: new Date().toISOString(),
      })),
    );

    onChange([...photos, ...nextPhotos]);
  }

  function updatePhoto(
    photoId: string,
    field: keyof Pick<ServiceOrderPhoto, "titulo" | "tipo" | "visibilidade">,
    value: string,
  ) {
    onChange(
      photos.map((photo) =>
        photo.id === photoId ? { ...photo, [field]: value } : photo,
      ),
    );
  }

  function removePhoto(photoId: string) {
    onChange(photos.filter((photo) => photo.id !== photoId));
  }

  return (
    <section className={sectionClass}>
      <div className="mb-5">
        <span className="text-sm font-semibold uppercase text-sky-400">
          Fotos
        </span>
        <h3 className="mt-1 text-2xl font-bold">Fotos da OS</h3>
        <p className="mt-2 text-sm text-slate-400">
          Controle quais imagens aparecem para cliente, fornecedor ou ficam
          apenas internas.
        </p>
      </div>

      <div>
        <label className={labelClass}>Adicionar fotos</label>
        <input
          type="file"
          multiple
          accept="image/*"
          className="w-full rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-100"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {photos.map((photo) => (
          <article
            key={photo.id}
            className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
          >
            {photo.dataUrl ? (
              <img
                src={photo.dataUrl}
                alt={photo.titulo || "Foto da OS"}
                className="h-44 w-full object-cover"
              />
            ) : (
              <div className="flex h-44 items-center justify-center bg-slate-900 text-sm text-slate-500">
                Imagem indisponível
              </div>
            )}

            <div className="grid gap-3 p-4">
              <div>
                <label className={labelClass}>Título</label>
                <input
                  className={inputClass}
                  value={photo.titulo}
                  onChange={(event) =>
                    updatePhoto(photo.id, "titulo", event.target.value)
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Tipo</label>
                  <select
                    className={inputClass}
                    value={photo.tipo}
                    onChange={(event) =>
                      updatePhoto(photo.id, "tipo", event.target.value)
                    }
                  >
                    {SERVICE_ORDER_PHOTO_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Visibilidade</label>
                  <select
                    className={inputClass}
                    value={photo.visibilidade}
                    onChange={(event) =>
                      updatePhoto(photo.id, "visibilidade", event.target.value)
                    }
                  >
                    {SERVICE_ORDER_PHOTO_VISIBILITIES.map((visibility) => (
                      <option key={visibility} value={visibility}>
                        {visibility}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="justify-self-start rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
              >
                Remover foto
              </button>
            </div>
          </article>
        ))}
      </div>

      {photos.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-sm text-slate-400">
          Nenhuma foto adicionada nesta OS.
        </div>
      )}
    </section>
  );
}
