function formatFileSize(size = 0) {
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function PhotoUploadStep({
  copy,
  imageFile,
  previewUrl,
  onImageChange,
  onClearImage,
  error
}) {
  return (
    <section className="flex flex-1 flex-col pt-6">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.photo.eyebrow}
        </p>
        <h2 className="text-[2rem] font-semibold tracking-tight text-ink">
          {copy.photo.title}
        </h2>
        <p className="text-sm leading-6 text-black/58">
          {copy.photo.description}
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-black/8 bg-white/90 shadow-soft">
        <label className="block cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
          {previewUrl ? (
            <div className="relative bg-[#f2e7d8]">
              <img
                src={previewUrl}
                alt={imageFile?.name || "preview"}
                className="h-[360px] w-full object-contain"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pb-4 pt-14 text-white">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{imageFile?.name}</p>
                    <p className="mt-1 text-xs text-white/78">{copy.photo.helper}</p>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs backdrop-blur">
                    {copy.photo.change}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f7efe4] text-2xl text-[#7d5724]">
                +
              </div>
              <p className="mt-5 text-base font-semibold text-ink">{copy.photo.title}</p>
              <p className="mt-2 text-sm leading-6 text-black/55">{copy.photo.helper}</p>
            </div>
          )}
        </label>

        {previewUrl ? (
          <div className="flex items-center justify-between gap-3 border-t border-black/5 bg-white/85 px-4 py-3">
            <div>
              <p className="text-xs text-black/46">
                {(imageFile?.type || "image/*").toUpperCase()} · {formatFileSize(imageFile?.size || 0)}
              </p>
              <p className="mt-1 text-xs font-medium text-[#7d5724]">{copy.photo.uploaded}</p>
            </div>
            <button
              type="button"
              onClick={onClearImage}
              className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:border-black/20 hover:bg-black/5"
            >
              {copy.photo.remove}
            </button>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-black/50">{copy.photo.empty}</p>
      {error ? <p className="mt-3 text-sm font-medium text-[#9c4c2c]">{error}</p> : null}
    </section>
  );
}
