export default function LoadingSpinner({ label = "Loading..." }) {
  return (
    <div className="ui-card flex flex-col items-center justify-center gap-3 rounded-3xl p-8 text-center backdrop-blur">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" />
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{label}</p>
    </div>
  );
}
