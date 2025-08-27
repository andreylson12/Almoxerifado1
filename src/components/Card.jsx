export default function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      {title && (
        <h2 className="text-lg font-semibold mb-3 border-b border-slate-100 pb-2">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
