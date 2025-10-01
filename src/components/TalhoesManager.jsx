import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2, Trash2, PencilLine, X } from "lucide-react";
import FazendaSelect from "./FazendaSelect";

export default function TalhoesManager({ onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedFazendaId, setSelectedFazendaId] = useState(null);

  const [form, setForm] = useState({ fazenda_id: null, nome: "", area_ha: "", obs: "" });
  const [editing, setEditing] = useState(null);

  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const fetchTalhoes = async () => {
    setLoading(true);
    try {
      let q = supabase.from("talhoes").select("*").order("nome", { ascending: true });
      if (selectedFazendaId) q = q.eq("fazenda_id", selectedFazendaId);
      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error(e);
      alert("Falha ao carregar talhões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTalhoes();
  }, [selectedFazendaId]);

  const save = async () => {
    try {
      if (!form.nome?.trim()) return alert("Informe o nome do talhão.");
      if (!form.fazenda_id && !selectedFazendaId) {
        return alert("Selecione a fazenda para vincular o talhão.");
      }

      const payload = {
        fazenda_id: Number(form.fazenda_id || selectedFazendaId),
        nome: form.nome.trim(),
        area_ha: form.area_ha ? Number(form.area_ha) : null,
        obs: form.obs?.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("talhoes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("talhoes").insert([payload]);
        if (error) throw error;
      }

      setForm({ fazenda_id: selectedFazendaId ?? null, nome: "", area_ha: "", obs: "" });
      setEditing(null);
      await fetchTalhoes();
      onChanged?.();
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar talhão.");
    }
  };

  const editRow = (r) => {
    setEditing(r);
    setForm({
      fazenda_id: r.fazenda_id ?? selectedFazendaId ?? null,
      nome: r.nome || "",
      area_ha: r.area_ha ?? "",
      obs: r.obs || "",
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ fazenda_id: selectedFazendaId ?? null, nome: "", area_ha: "", obs: "" });
  };

  const remove = async (r) => {
    if (!confirm(`Excluir o talhão "${r.nome}"?`)) return;
    try {
      const { error } = await supabase.from("talhoes").delete().eq("id", r.id);
      if (error) throw error;
      await fetchTalhoes();
      onChanged?.();
    } catch (e) {
      console.error(e);
      alert("Falha ao excluir talhão.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtro: fazenda */}
      <div className="bg-white p-3 rounded border">
        <h4 className="font-semibold mb-2">Fazenda</h4>
        <FazendaSelect
          value={selectedFazendaId}
          onChange={(id) => {
            setSelectedFazendaId(id ? Number(id) : null);
            // também prepara o form para já vincular à fazenda
            setForm((s) => ({ ...s, fazenda_id: id ? Number(id) : null }));
          }}
          allowCreate={true}
        />
      </div>

      {/* Form */}
      <div className="bg-white p-3 rounded border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">{editing ? "Editar talhão" : "Novo talhão"}</h4>
          {editing && (
            <button onClick={cancelEdit} className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-1">
            <label className="block text-sm text-slate-600 mb-1">Fazenda</label>
            <FazendaSelect
              value={form.fazenda_id ?? selectedFazendaId ?? ""}
              onChange={(id) => setF("fazenda_id", id ? Number(id) : null)}
              allowCreate={false}
              className="w-full"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm text-slate-600 mb-1">Nome</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="Ex: T-01"
              value={form.nome}
              onChange={(e) => setF("nome", e.target.value)}
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm text-slate-600 mb-1">Área (ha)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="Área"
              type="number"
              value={form.area_ha}
              onChange={(e) => setF("area_ha", e.target.value)}
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm text-slate-600 mb-1">Observações</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="Observações"
              value={form.obs}
              onChange={(e) => setF("obs", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <button
            onClick={save}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
          >
            {editing ? "Salvar alterações" : "Adicionar"}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded border">
        <table className="w-full bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Talhão</th>
              <th className="p-2 text-right">Área (ha)</th>
              <th className="p-2 text-left">Observações</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-center" colSpan={4}>
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={4}>
                  {selectedFazendaId ? "Nenhum talhão nesta fazenda." : "Selecione uma fazenda para listar os talhões."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.nome}</td>
                  <td className="p-2 text-right">
                    {Number(r.area_ha || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2">{r.obs || "—"}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => editRow(r)}
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 mr-3"
                    >
                      <PencilLine className="h-4 w-4" /> Editar
                    </button>
                    <button
                      onClick={() => remove(r)}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" /> Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
