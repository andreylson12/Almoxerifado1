import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2, Trash2, PencilLine, X } from "lucide-react";

/**
 * Props:
 * - onChanged?: () => void
 * - currentFazendaId?: number | string   // id da fazenda selecionada na página pai
 */
export default function TalhoesManager({ onChanged, currentFazendaId }) {
  // Fazendas e seleção
  const [fazendas, setFazendas] = useState([]);
  const [fazendaId, setFazendaId] = useState("");

  // Talhões
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [form, setForm] = useState({ nome: "", area_ha: "", obs: "" });
  const [editing, setEditing] = useState(null);
  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  /* ---------- Carregadores ---------- */
  const fetchFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from("fazendas")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (e) {
      console.error(e);
      alert("Falha ao carregar fazendas.");
    }
  };

  const fetchTalhoes = async (idParaFiltrar) => {
    setLoading(true);
    try {
      let q = supabase.from("talhoes").select("*").order("nome", { ascending: true });
      if (idParaFiltrar) q = q.eq("fazenda_id", idParaFiltrar);

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

  /* Prefill de fazenda vinda do pai */
  useEffect(() => {
    fetchFazendas();
  }, []);

  useEffect(() => {
    // se o pai informar, já fixa aqui
    if (currentFazendaId) {
      setFazendaId(String(currentFazendaId));
      fetchTalhoes(currentFazendaId);
    } else {
      // sem filtro inicial
      fetchTalhoes(null);
    }
  }, [currentFazendaId]);

  // ao trocar a fazenda no select interno, recarrega os talhões
  useEffect(() => {
    if (fazendaId) fetchTalhoes(fazendaId);
  }, [fazendaId]);

  /* ---------- Ações ---------- */
  const save = async () => {
    try {
      if (!fazendaId) return alert("Selecione a fazenda.");
      if (!form.nome?.trim()) return alert("Informe o nome do talhão.");
      const payload = {
        fazenda_id: Number(fazendaId),
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

      setForm({ nome: "", area_ha: "", obs: "" });
      setEditing(null);
      await fetchTalhoes(fazendaId);
      onChanged?.();
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar talhão.");
    }
  };

  const editRow = (r) => {
    setEditing(r);
    setForm({
      nome: r.nome || "",
      area_ha: r.area_ha ?? "",
      obs: r.obs || "",
    });
    setFazendaId(String(r.fazenda_id || ""));
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
      await fetchTalhoes(fazendaId);
      onChanged?.();
    } catch (e) {
      console.error(e);
      alert("Falha ao excluir talhão.");
    }
  };

  // Faz um map id->nome para mostrar o nome da fazenda na tabela
  const fazendaNomePorId = useMemo(() => {
    const map = new Map();
    fazendas.forEach((f) => map.set(String(f.id), f.nome));
    return map;
  }, [fazendas]);

  return (
    <div className="space-y-4">
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
          {/* Fazenda */}
          <select
            className="border rounded px-3 py-2"
            value={fazendaId}
            onChange={(e) => setFazendaId(e.target.value)}
          >
            <option value="">Selecione a fazenda...</option>
            {fazendas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>

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
            value={form.area_ha}
            onChange={(e) => setF("area_ha", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 md:col-span-1 col-span-1"
            placeholder="Observações"
            value={form.obs}
            onChange={(e) => setF("obs", e.target.value)}
          />
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
              <th className="p-2 text-left">Fazenda</th>
              <th className="p-2 text-right">Área (ha)</th>
              <th className="p-2 text-left">Observações</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-center" colSpan={5}>
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={5}>
                  Nenhum talhão.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.nome}</td>
                  <td className="p-2">
                    {fazendaNomePorId.get(String(r.fazenda_id)) || `#${r.fazenda_id}`}
                  </td>
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
