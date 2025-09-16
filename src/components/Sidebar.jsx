import { LayoutDashboard, Package, Shield, ClipboardList, Tractor, Users, Warehouse, Wheat, Sprout } from "lucide-react";

const itemBase =
  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-slate-100 transition";

export default function Sidebar({ current, onChange }) {
  const Item = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => onChange(id)}
      className={`${itemBase} ${current === id ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "text-slate-700"}`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="w-[230px] shrink-0 bg-white rounded-xl shadow p-3 h-fit">
      <div className="px-2 py-1 text-xs font-semibold text-slate-500">Painel</div>
      <Item id="Painel" icon={LayoutDashboard} label="Painel" />

      <div className="px-2 py-1 mt-3 text-xs font-semibold text-slate-500">Estoque</div>
      <Item id="Movimentações" icon={ClipboardList} label="Movimentações" />
      <Item id="Produtos"        icon={Package}        label="Produtos" />
      <Item id="Defensivos"      icon={Shield}         label="Defensivos" />
      <Item id="Inventário"      icon={Warehouse}      label="Inventário" />

      <div className="px-2 py-1 mt-3 text-xs font-semibold text-slate-500">Operação</div>
      <Item id="Máquinas"     icon={Tractor} label="Máquinas" />
      <Item id="Funcionários" icon={Users}   label="Funcionários" />
      <Item id="Colheita"     icon={Wheat}   label="Colheita" />
      <Item id="Plantios"     icon={Sprout}  label="Plantios" />
    </aside>
  );
}
