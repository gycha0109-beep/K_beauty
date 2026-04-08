export default function UploadPreview({ imageFile, previewUrl, onChange, onClear }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-ink">얼굴 사진 업로드</label>
        {imageFile ? (
          <span className="rounded-full bg-sage/10 px-3 py-1 text-xs font-medium text-sage">
            1장 업로드 완료
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-black/10 bg-[#fbf8f2]">
        <label className="block cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={onChange} />
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="업로드한 얼굴 사진 미리보기"
                className="h-72 w-full object-cover sm:h-80"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent px-4 pb-4 pt-12 text-white">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{imageFile?.name}</p>
                    <p className="mt-1 text-xs text-white/80">
                      정면에 가깝고 얼굴선이 잘 보이는 사진일수록 결과가 더 자연스럽게 정리됩니다.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs backdrop-blur">
                    사진 변경
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                <span className="text-xl">+</span>
              </div>
              <p className="mt-4 text-base font-medium text-ink">분석할 얼굴 사진 1장을 업로드해 주세요</p>
              <p className="mt-2 text-sm leading-6 text-black/55">
                JPG, PNG 가능
                <br />
                정면에 가깝고 밝은 사진을 권장합니다
              </p>
            </div>
          )}
        </label>

        {previewUrl ? (
          <div className="flex items-center justify-between gap-3 border-t border-black/5 bg-white/80 px-4 py-3">
            <p className="truncate text-xs text-black/50">
              {imageFile?.type || "image/*"} · {Math.round((imageFile?.size || 0) / 1024)} KB
            </p>
            <button
              type="button"
              onClick={onClear}
              className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black/65 transition hover:border-black/20 hover:bg-black/5"
            >
              제거
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
