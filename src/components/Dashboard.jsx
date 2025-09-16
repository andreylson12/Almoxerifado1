import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function k(n){ return Number(n||0); }

export default function Dashboard(){
  const [cards, setCards] = useState({
    produtos: 0,
    entradasMes: 0,
    saidasMes: 0,
    colheitaMesKg: 0,
  });
  const [serie, setSerie] = useState([]); // últimos 7 dias (movimentações líquidas)

  useEffect(() => {
    const run = async () => {
      // período do mês
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      const from = new Date(y, m, 1).toISOString();
      const to   = new Date(y, m+1, 0, 23,59,59).toISOString();

      // produtos (contagem)
      const prodQ = await supabase.from("produtos").select("id", { count: "exact", head: true });

      // movimentações mês
      const movQ  = await supabase
        .from("movimentacoes")
        .select("tipo, quantidade, created_at")
        .gte("created_at", from).lte("created_at", to);

      // colheita mês (líquido)
      const colQ  = await supabase
        .from("colheita_cargas")
        .select("peso_bruto_kg, tara_kg, peso_liquido_kg, data")
        .gte("data", from.slice(0,10)).lte("data", to.slice(0,10));

      let entradasMes = 0, saidasMes = 0;
      (movQ.data || []).forEach(r=>{
        if(r.tipo === "Entrada") entradasMes += k(r.quantidade);
        else                      saidasMes   += k(r.quantidade);
      });

      let colheitaMesKg = 0;
      (colQ.data || []).forEach(r=>{
        const liq = r.peso_liquido_kg != null
          ? k(r.peso_liquido_kg)
          : Math.max(0, k(r.peso_bruto_kg)-k(r.tara_kg));
        colheitaMesKg += liq;
      });

      setCards({
        produtos: prodQ.count || 0,
        entradasMes, saidasMes, colheitaMesKg,
      });

      // série últimos 7 dias (saldo de movimentações)
      const days = [...Array(7)].map((_,i)=>{
        const d = new Date(); d.setDate(d.getDate() - (6-i));
        return d.toISOString().slice(0,10);
      });
      const byDay = Object.fromEntries(days.map(d=>[d,0]));
      (movQ.data || []).forEach(r=>{
        const d = r.created_at?.slice(0,10);
        if(!d || !(d in byDay)) return;
        byDay[d] += (r.tipo==="Entrada" ? 1 : -1) * k(r.quantidade);
      });
      setSerie(days.map(d=>({ d, v: byDay[d] })));
    };
    run();
  }, []);

  const maxAbs = Math.max(10, ...serie.map(s=>Math.abs(s.v)));

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Produtos" value={cards.produtos.toLocaleString()} />
        <Card title="Entradas (mês)" value={cards.entradasMes.toLocaleString()} tone="green" />
        <Card title="Saídas (mês)" value={cards.saidasMes.toLocaleString()} tone="red" />
        <Card title="Colheita (kg - mês)" value={cards.colheitaMesKg.toLocaleString()} tone="indigo" />
      </div>

      {/* Mini-gráfico de barras (saldo diário) */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="mb-2 text-sm text-slate-600">Saldo diário de movimentações (últimos 7 dias)</div>
        <div className="flex items-end gap-2 h-40">
          {serie.map((s)=>(
            <div key={s.d} className="flex-1 flex flex-col items-center">
              <div
                className={`w-6 rounded-t ${s.v>=0 ? "bg-green-500/70" : "bg-red-500/70"}`}
                style={{ height: `${Math.round(Math.abs(s.v)/maxAbs*100)}%` }}
                title={`${s.d} → ${s.v}`}
              />
              <div className="mt-1 text-[10px] text-slate-500">{s.d.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, tone="blue" }){
  const tones = {
    blue:   "bg-blue-50 text-blue-800 ring-blue-200",
    green:  "bg-green-50 text-green-800 ring-green-200",
    red:    "bg-red-50 text-red-800 ring-red-200",
    indigo: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  }[tone];

  return (
    <div className={`bg-white rounded-xl shadow p-4 ring-1 ${tones.replace("text-","ring-")}`}>
      <div className="text-sm text-slate-600">{title}</div>
      <div className={`text-2xl font-semibold mt-1 ${tones.split(" ")[1]}`}>{value}</div>
    </div>
  );
}
