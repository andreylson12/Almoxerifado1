// src/components/TalhoesManager.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2, Trash2, PencilLine, X } from "lucide-react";

export default function TalhoesManager({ onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ nome: "", area_ha: "", obs: "" });
  const [editing, setEditing] = useState(null);

  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const fetchTalhoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("talhoes")
        .select("id, nome, area_ha, obs")
        .order("nome", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error("Erro ao carregar talhões:", e);
      alert(`Falha ao carregar talhões.\n${e.message || ""}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTalhoes();
  }, []);

  const save = async () => {
    try {
      if (!form.nome?.trim()) return alert("Informe o nome do talhão.");
      setSaving(true);

      const payload = {
        nome: form.nome.trim(),
        area_ha: form.area_ha !== "" && form.area_ha !== null ? Number(form.area_ha) : null,
        obs: form.obs?.trim() || null,
      };

      if (Number.isNaN(payload.area_ha)) {
        return alert("Área (ha) deve ser um número válido.");
      }

      if (editing?.id) {
        const { error } = await supabase
          .from("talhoes")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("talhoes").insert([payload]);
        if (error) throw error;
      }

      setForm({ nome: "", area_ha: "", obs: "" });
      setEditing(null);
      await fetchTalhoes();
      onChanged?.();
    } catch (e) {
      console.error("Erro ao salvar talhão:", e);
      alert(`Falha ao salvar talhão.\n${e.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const editRow = (r) => {
    setEditing(r);
    setForm({
      nome: r.nome || "",
      area_ha: r.area_ha ?? "",
      obs: r.obs || "",
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ nome: "", area_ha: "", obs: "" });
  };

  const remove = async (r) => {
    if (!confirm(`Excluir o talhão "${r.nome}"?`)) return;
    try {
      const { error } = await supabase.from("talhoes").delete().eq("id", r.id);
      if (error) throw error;
      await fetchTalhoes();
      onChanged?.();
    } catch (e) {
      console.error("Erro ao excluir talhão:", e);
      alert(`Falha ao excluir talhão.\n${e.message || ""}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="bg-white p-3 rounded border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">{editing ? "Editar talhão" : "Novo talhão"}</h4>
          {editing && (
            <button
              onClick={cancelEdit}
              className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Nome (ex: T-01)"
            value={form.nome}
            onChange={(e) => setF("nome", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Área (ha)"
            type="number"
            inputMode="decimal"
            value={form.area_ha}
            onChange={(e) => setF("area_ha", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Observações"
            value={form.obs}
            onChange={(e) => setF("obs", e.target.value)}
          />
        </div>

        <div className="flex justify-end mt-3">
          <button
            onClick={save}
            disabled={saving}
            className={`px-4 py-2 rounded text-white ${
              saving ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Adicionar"}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded border">
        <table className="w-full bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Nome</th>
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
                  Nenhum talhão.
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
