export default function LoadingSpinner({ label = "결과를 생성하는 중입니다..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-black/5 bg-white/80 p-8 text-center shadow-soft backdrop-blur">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-black" />
      <p className="text-sm text-black/70">{label}</p>
    </div>
  );
}
