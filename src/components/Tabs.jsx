export default function Tabs({ tabs, current, onChange }) {
  return (
    <div className="flex gap-2 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t}
          className={`px-4 py-2 text-sm font-medium ${
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
  );
}
