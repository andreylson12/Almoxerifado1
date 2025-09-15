export default function Tabs({ tabs, current, onChange }) {
  return (
    <div className="overflow-x-auto border-b border-slate-200">
      <div className="flex gap-2 min-w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            className={`shrink-0 px-4 py-2 text-sm font-medium ${
              current === t
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-600 hover:text-slate-800"
            }`}
            onClick={() => onChange(t)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
