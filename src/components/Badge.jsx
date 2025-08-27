export default function Badge({ children, color = "blue" }) {
  const colors = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`px-2 py-1 text-xs rounded-full ${colors[color]}`}>
      {children}
    </span>
  );
}
