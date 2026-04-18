import LoadingSpinner from "@/components/LoadingSpinner";

export default function LoadingStep({ copy, isSubmitting }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="ui-card w-full max-w-sm px-6 py-8">
        <LoadingSpinner label={copy.loading.title} />
        <p className="ui-text-secondary mt-5 text-sm leading-6">
          {copy.loading.description}
        </p>
        {isSubmitting ? (
          <div className="mt-6 flex justify-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-900 [animation-delay:120ms] dark:bg-zinc-100" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-900 [animation-delay:240ms] dark:bg-zinc-100" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
