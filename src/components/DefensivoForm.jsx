import { useState } from "react";
import { PlusCircle } from "lucide-react";

const TIPOS = ["Herbicida", "Fungicida", "Inseticida", "Acaricida", "Nematicida", "Adjuvante", "Outro"];
const UNIDADES = ["L", "mL", "kg", "g"];

export default function DefensivoForm({ onAdd }) {
  const [form, setForm] = useState({
    nome: "",
    tipo: "Herbicida",
    unidade: "L",
    concentracao: "",
    fabricante: "",
    registro_mapa: "",
    classe_toxica: "",
    localizacao: "",
    quantidade: 0,
  });

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return alert("Informe o nome do defensivo.");
    onAdd?.({
      ...form,
      nome: form.nome.trim(),
      concentracao: form.concentracao?.trim() || null,
      fabricante: form.fabricante?.trim() || null,
      registro_mapa: form.registro_mapa?.trim() || null,
      classe_toxica: form.classe_toxica?.trim() || null,
      localizacao: form.localizacao?.trim() || null,
      quantidade: Number(form.quantidade || 0),
    });
    setForm({
      nome: "", tipo: "Herbicida", unidade: "L", concentracao: "", fabricante: "",
      registro_mapa: "", classe_toxica: "", localizacao: "", quantidade: 0,
    });
  };

  return (
    <form onSubmit={submit} className="bg-white shadow-md rounded-lg p-6 space-y-3">
      <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
        <PlusCircle className="h-5 w-5 text-blue-600" /> Cadastrar Defensivo
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className="border rounded-lg px-3 py-2" placeholder="Nome"
          value={form.nome} onChange={(e)=>set("nome", e.target.value)} />

        <select className="border rounded-lg px-3 py-2" value={form.tipo}
          onChange={(e)=>set("tipo", e.target.value)}>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select className="border rounded-lg px-3 py-2" value={form.unidade}
          onChange={(e)=>set("unidade", e.target.value)}>
          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <input className="border rounded-lg px-3 py-2" placeholder="Concentração (ex: 480 g/L)"
          value={form.concentracao} onChange={(e)=>set("concentracao", e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Fabricante"
          value={form.fabricante} onChange={(e)=>set("fabricante", e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Registro MAPA"
          value={form.registro_mapa} onChange={(e)=>set("registro_mapa", e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Classe Tóxica"
          value={form.classe_toxica} onChange={(e)=>set("classe_toxica", e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="Localização (ex: Depósito 1)"
          value={form.localizacao} onChange={(e)=>set("localizacao", e.target.value)} />
        <input type="number" className="border rounded-lg px-3 py-2" placeholder="Quantidade inicial"
          value={form.quantidade} onChange={(e)=>set("quantidade", e.target.value)} />
      </div>

      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg">
        <PlusCircle className="inline h-4 w-4 mr-2" /> Salvar
      </button>
    </form>
  );
}
