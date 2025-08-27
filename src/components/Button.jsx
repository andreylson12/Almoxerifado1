export default function Button({ children, variant = "primary", ...props }) {
  const base =
    "px-3 py-2 text-sm font-medium rounded-lg focus:outline-none transition";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary:
      "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200",
    danger: "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200",
  };

  return (
    <button className={`${base} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
}
