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
        <p className="ui-kicker">{copy.photo.eyebrow}</p>
        <h2 className="ui-title text-[2rem]">{copy.photo.title}</h2>
        <p className="ui-text-secondary text-sm leading-6">{copy.photo.description}</p>
      </div>

      <div className="ui-card mt-8 overflow-hidden">
        <label className="block cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
          {previewUrl ? (
            <div className="relative bg-zinc-100 dark:bg-zinc-800">
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
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-2xl text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                +
              </div>
              <p className="mt-5 text-base font-semibold text-zinc-900 dark:text-zinc-100">{copy.photo.title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy.photo.helper}</p>
            </div>
          )}
        </label>

        {previewUrl ? (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-white/85 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/85">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {(imageFile?.type || "image/*").toUpperCase()} 쨌 {formatFileSize(imageFile?.size || 0)}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">{copy.photo.uploaded}</p>
            </div>
            <button
              type="button"
              onClick={onClearImage}
              className="ui-button-secondary px-3 py-1.5 text-xs font-medium"
            >
              {copy.photo.remove}
            </button>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy.photo.empty}</p>
      {error ? <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}
