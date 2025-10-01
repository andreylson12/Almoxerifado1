import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function FazendaSelect({ value, onChange, allowCreate = true, className = "" }) {
  const [list, setList] = useState([]);
  const [nome, setNome] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("fazendas")
      .select("*")
      .order("nome", { ascending: true });
    if (!error) setList(data || []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const n = nome.trim();
    if (!n) return;
    const { data, error } = await supabase
      .from("fazendas")
      .insert([{ nome: n }])
      .select();
    if (!error && data?.[0]) {
      setList((prev) => [...prev, data[0]].sort((a, b) => a.nome.localeCompare(b.nome)));
      onChange?.(data[0].id);
      setNome("");
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        className="border rounded px-3 py-2"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Selecione a fazenda…</option>
        {list.map(f => (
          <option key={f.id} value={f.id}>{f.nome}</option>
        ))}
      </select>

      {allowCreate && (
        <>
          <input
            className="border rounded px-3 py-2"
            placeholder="Nova fazenda"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <button
            onClick={add}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded"
          >
            + Adicionar
          </button>
        </>
      )}
    </div>
  );
}
