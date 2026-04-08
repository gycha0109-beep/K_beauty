export default function ResultCard({ title, items, text, tone = "default" }) {
  const tones = {
    default: "bg-white/85",
    soft: "bg-[#fffaf4]/90",
    accent: "bg-[#f5efe6]/95"
  };

  return (
    <section
      className={`rounded-3xl border border-black/5 p-6 shadow-soft backdrop-blur ${tones[tone] || tones.default}`}
    >
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {text ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-black/75">{text}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items?.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-black/80"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
