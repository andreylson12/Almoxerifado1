import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import DefensivoForm from "./DefensivoForm";
import DefensivosImportXML from "./DefensivosImportXML";

function Badge({ q }) {
  const n = Number(q || 0);
  const cls =
    n > 50 ? "bg-green-100 text-green-700" :
    n > 10 ? "bg-yellow-100 text-yellow-700" :
             "bg-red-100 text-red-700";
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cls}`}>{n}</span>;
}

export default function Defensivos() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("defensivos").select("*").order("nome", { ascending: true });
    if (!error) setRows(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (def) => {
    const { error } = await supabase.from("defensivos").insert([def]);
    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      load();
    }
  };

  const filtered = q.trim()
    ? rows.filter(r =>
        (r.nome || "").toLowerCase().includes(q.toLowerCase()) ||
        (r.ncm || "").includes(q.replace(/\D/g, ""))
      )
    : rows;

  return (
    <div className="space-y-6">
      <DefensivoForm onAdd={handleAdd} />

      <DefensivosImportXML />

      <div className="flex items-center justify-between gap-3">
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Pesquisar por nome ou NCM…"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg shadow-md">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr className="bg-gray-200 text-gray-700 text-sm uppercase">
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">NCM</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Unidade</th>
              <th className="px-4 py-3 text-center">Qtd.</th>
              <th className="px-4 py-3 text-left">Localização</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={d.id} className={`${i % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-blue-50 transition`}>
                <td className="px-4 py-2">{d.nome}</td>
                <td className="px-4 py-2">{d.ncm || "—"}</td>
                <td className="px-4 py-2">{d.tipo || "—"}</td>
                <td className="px-4 py-2">{d.unidade || "—"}</td>
                <td className="px-4 py-2 text-center"><Badge q={d.quantidade} /></td>
                <td className="px-4 py-2">{d.localizacao || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Nenhum defensivo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
