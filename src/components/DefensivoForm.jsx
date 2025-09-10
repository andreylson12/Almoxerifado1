import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { inferTipoFromNcm } from "../lib/ncmMap";

const TIPOS = ["Herbicida", "Fungicida", "Inseticida", "Acaricida", "Nematicida", "Adjuvante", "Fertilizante", "Desinfetante", "Outro"];
const UNIDADES = ["L", "mL", "kg", "g"];

export default function DefensivoForm({ onAdd }) {
  const [form, setForm] = useState({
    nome: "",
    ncm: "",
    tipo: "Herbicida",
    unidade: "L",
    concentracao: "",
    fabricante: "",
    registro_mapa: "",
    classe_toxica: "",
    localizacao: "",
    quantidade: 0,
  });
  const [tipoLock, setTipoLock] = useState(false); // se o usuário trocar manualmente, não sobrescreve mais

  const set = (k, v) => {
    setForm((s) => ({ ...s, [k]: v }));
  };

  const onChangeNcm = (v) => {
    set("ncm", v);
    if (!tipoLock) {
      const { tipo } = inferTipoFromNcm(v, form.nome);
      set("tipo", tipo);
    }
  };

  const onChangeNome = (v) => {
    set("nome", v);
    if (!tipoLock && form.ncm) {
      const { tipo } = inferTipoFromNcm(form.ncm, v);
      set("tipo", tipo);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return alert("Informe o nome do defensivo.");
    onAdd?.({
      ...form,
      nome: form.nome.trim(),
      ncm: form.ncm?.replace(/\D/g, "") || null,
      concentracao: form.concentracao?.trim() || null,
      fabricante: form.fabricante?.trim() || null,
      registro_mapa: form.registro_mapa?.trim() || null,
      classe_toxica: form.classe_toxica?.trim() || null,
      localizacao: form.localizacao?.trim() || null,
      quantidade: Number(form.quantidade || 0),
    });
    // reset
    setForm({
      nome: "", ncm: "", tipo: "Herbicida", unidade: "L", concentracao: "",
      fabricante: "", registro_mapa: "", classe_toxica: "", localizacao: "", quantidade: 0,
    });
    setTipoLock(false);
  };

  return (
    <form onSubmit={submit} className="bg-white shadow-md rounded-lg p-6 space-y-3">
      <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
        <PlusCircle className="h-5 w-5 text-blue-600" /> Cadastrar Defensivo
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Nome"
          value={form.nome}
          onChange={(e)=>onChangeNome(e.target.value)}
        />

        <input
          className="border rounded-lg px-3 py-2"
          placeholder="NCM (ex.: 38089329)"
          value={form.ncm}
          onChange={(e)=>onChangeNcm(e.target.value)}
        />

        <select
          className="border rounded-lg px-3 py-2"
          value={form.tipo}
          onChange={(e)=>{ set("tipo", e.target.value); setTipoLock(true); }}
          title={tipoLock ? "Você ajustou manualmente; não sugerirei mais automaticamente" : "Posso sugerir automaticamente a partir do NCM"}
        >
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
