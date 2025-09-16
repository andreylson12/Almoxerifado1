// src/components/Tabs.jsx
export default function Tabs({ tabs, current, onChange }) {
  // aceita ["Produtos", ...] ou [{ id, label, icon: Icon, count, disabled }, ...]
  const items = (tabs || []).map((t) =>
    typeof t === "string" ? { id: t, label: t } : t
  );

  return (
    <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60">
      <div className="relative overflow-x-auto">
        {/* bordas de gradiente nas laterais (efeito pro) */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-slate-50 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-slate-50 to-transparent" />

        <div className="flex gap-2 p-1 min-w-fit" role="tablist" aria-label="Navegação">
          {items.map((item) => {
            const active =
              current === item.id || current === item.label;
            const Icon = item.icon;

            return (
              <button
                key={item.id || item.label}
                role="tab"
                aria-selected={active}
                disabled={item.disabled}
                onClick={() => !item.disabled && onChange(item.id || item.label)}
                className={[
                  "shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition",
                  active
                    ? "bg-blue-600 text-white border-blue-600 shadow"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                  item.disabled && "opacity-50 cursor-not-allowed",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50",
                ].join(" ")}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span className="whitespace-nowrap">{item.label}</span>
                {typeof item.count === "number" && (
                  <span
                    className={[
                      "ml-1 inline-flex items-center justify-center rounded-full text-[11px] px-2 h-5",
                      active ? "bg-white/20" : "bg-slate-100 text-slate-700",
                    ].join(" ")}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
