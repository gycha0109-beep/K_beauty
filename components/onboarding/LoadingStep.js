export default function LoadingStep({ copy, isSubmitting }) {
  return (
    <section className="flex min-h-[calc(100svh-5.5rem)] flex-1 flex-col items-center justify-center py-8 text-center sm:min-h-[calc(100svh-6.5rem)] sm:py-10">
      <div className="ui-card w-full max-w-sm px-6 py-9 sm:px-8 sm:py-10" aria-live="polite">
        <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" />
        <h2 className="ui-title mx-auto mt-6 max-w-[18rem] text-lg leading-7">
          {copy.loading.title}
        </h2>
        <p className="ui-text-secondary mx-auto mt-4 max-w-[18rem] text-sm leading-6">
          {copy.loading.description}
        </p>
        {isSubmitting ? (
          <div className="mt-7 flex justify-center gap-2">
            <span className="ui-progress-active h-2.5 w-2.5 animate-pulse rounded-full" />
            <span className="ui-progress-active h-2.5 w-2.5 animate-pulse rounded-full [animation-delay:120ms]" />
            <span className="ui-progress-active h-2.5 w-2.5 animate-pulse rounded-full [animation-delay:240ms]" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
