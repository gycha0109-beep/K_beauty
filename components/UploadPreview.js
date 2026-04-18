const MESSAGES = {
  ko: {
    label: "얼굴 사진 업로드",
    uploaded: "업로드 완료",
    alt: "업로드한 얼굴 사진 미리보기",
    hint: "밝은 정면 사진 권장",
    changePhoto: "사진 변경",
    uploadTitle: "얼굴 사진 1장을 올려 주세요",
    uploadBody: "JPG, PNG, WEBP 지원",
    remove: "삭제",
    noImage: "사진 없음",
    metaSeparator: "·"
  },
  en: {
    label: "Upload a face photo",
    uploaded: "Uploaded",
    alt: "Preview of the uploaded face photo",
    hint: "A bright front-facing photo works best",
    changePhoto: "Change photo",
    uploadTitle: "Upload one face photo",
    uploadBody: "JPG, PNG, WEBP supported",
    remove: "Remove",
    noImage: "No image",
    metaSeparator: "·"
  }
};

export default function UploadPreview({ imageFile, previewUrl, onChange, onClear, locale = "ko" }) {
  const t = MESSAGES[locale] || MESSAGES.ko;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.label}</label>
        {imageFile ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {t.uploaded}
          </span>
        ) : null}
      </div>

      <div className="ui-card overflow-hidden rounded-[1.5rem] p-0">
        <label className="block cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={onChange} />
          {previewUrl ? (
            <div className="relative bg-zinc-100 dark:bg-zinc-800">
              <img src={previewUrl} alt={t.alt} className="h-64 w-full object-contain sm:h-72" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-4 pb-4 pt-12 text-white">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{imageFile?.name || t.noImage}</p>
                    <p className="mt-1 text-xs text-white/80">{t.hint}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs backdrop-blur">
                    {t.changePhoto}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 shadow-sm dark:bg-zinc-800">
                <span className="text-xl text-zinc-600 dark:text-zinc-300">+</span>
              </div>
              <p className="mt-4 text-base font-medium text-zinc-900 dark:text-zinc-100">{t.uploadTitle}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t.uploadBody}</p>
            </div>
          )}
        </label>

        {previewUrl ? (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {imageFile?.type || "image/*"} {t.metaSeparator} {Math.round((imageFile?.size || 0) / 1024)} KB
            </p>
            <button
              type="button"
              onClick={onClear}
              className="ui-button-secondary px-3 py-1 text-xs font-medium"
            >
              {t.remove}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
