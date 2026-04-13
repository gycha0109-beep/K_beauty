import LoadingSpinner from "@/components/LoadingSpinner";

export default function LoadingStep({ copy, isSubmitting }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="w-full max-w-sm rounded-[2rem] border border-black/5 bg-white/88 px-6 py-8 shadow-soft">
        <LoadingSpinner label={copy.loading.title} />
        <p className="mt-5 text-sm leading-6 text-black/58">
          {copy.loading.description}
        </p>
        {isSubmitting ? (
          <div className="mt-6 flex justify-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#1f1811]" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#1f1811] [animation-delay:120ms]" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#1f1811] [animation-delay:240ms]" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
