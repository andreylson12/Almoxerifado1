import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2, Edit3, Trash2, Save, X } from "lucide-react";

export default function Plantios() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // form novo
  const [form, setForm] = useState({
    cultura: "",
    variedade: "",
    safra: "",
    talhao: "",
    area_ha: "",
    data_plantio: "",
    espacamento: "",
    populacao_ha: "",
    observacoes: "",
  });
  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // edição linha
  const [editId, setEditId] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("plantios")
        .select("*")
        .order("data_plantio", { ascending: false })
        .order("id", { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      console.error(err);
      alert("Falha ao carregar plantios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [
        r.cultura,
        r.variedade,
        r.safra,
        r.talhao,
        String(r.area_ha),
        r.observacoes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [q, rows]);

  const addRow = async () => {
    try {
      if (!form.cultura) return alert("Informe a cultura.");
      const payload = {
        cultura: form.cultura,
        variedade: form.variedade || null,
        safra: form.safra || null,
        talhao: form.talhao || null,
        area_ha: form.area_ha ? Number(form.area_ha) : null,
        data_plantio: form.data_plantio || null,
        espacamento: form.espacamento || null,
        populacao_ha: form.populacao_ha ? Number(form.populacao_ha) : null,
        observacoes: form.observacoes || null,
      };
      const { error } = await supabase.from("plantios").insert([payload]);
      if (error) throw error;
      setForm({
        cultura: "",
        variedade: "",
        safra: "",
        talhao: "",
        area_ha: "",
        data_plantio: "",
        espacamento: "",
        populacao_ha: "",
        observacoes: "",
      });
      fetchRows();
    } catch (err) {
      console.error(err);
      alert("Falha ao salvar plantio.");
    }
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setEditRow({ ...r, area_ha: r.area_ha ?? "", populacao_ha: r.populacao_ha ?? "" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditRow(null);
  };

  const saveEdit = async () => {
    try {
      const payload = {
        cultura: editRow.cultura || null,
        variedade: editRow.variedade || null,
        safra: editRow.safra || null,
        talhao: editRow.talhao || null,
        area_ha: editRow.area_ha === "" ? null : Number(editRow.area_ha),
        data_plantio: editRow.data_plantio || null,
        espacamento: editRow.espacamento || null,
        populacao_ha: editRow.populacao_ha === "" ? null : Number(editRow.populacao_ha),
        observacoes: editRow.observacoes || null,
      };
      const { error } = await supabase.from("plantios").update(payload).eq("id", editId);
      if (error) throw error;
      cancelEdit();
      fetchRows();
    } catch (err) {
      console.error(err);
      alert("Falha ao salvar alterações.");
    }
  };

  const delRow = async (r) => {
    try {
      const ok = window.confirm(
        `Excluir plantio "${r.cultura}" (talhão ${r.talhao || "—"})?\n` +
        `As cargas de colheita vinculadas (plantio_id=${r.id}) serão mantidas, mas sem vínculo.`
      );
      if (!ok) return;
      const { error } = await supabase.from("plantios").delete().eq("id", r.id);
      if (error) throw error;
      fetchRows();
    } catch (err) {
      console.error(err);
      alert("Falha ao excluir plantio.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Formulário */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <h3 className="font-semibold">Novo plantio</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Cultura (ex: Soja)"
                 value={form.cultura} onChange={(e)=>setF("cultura", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Variedade"
                 value={form.variedade} onChange={(e)=>setF("variedade", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Safra (ex: 24/25)"
                 value={form.safra} onChange={(e)=>setF("safra", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Talhão"
                 value={form.talhao} onChange={(e)=>setF("talhao", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Área (ha)" type="number"
                 value={form.area_ha} onChange={(e)=>setF("area_ha", e.target.value)} />
          <input className="border rounded px-3 py-2" type="date"
                 value={form.data_plantio} onChange={(e)=>setF("data_plantio", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Espaçamento"
                 value={form.espacamento} onChange={(e)=>setF("espacamento", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="População/ha" type="number"
                 value={form.populacao_ha} onChange={(e)=>setF("populacao_ha", e.target.value)} />
        </div>
        <textarea className="border rounded px-3 py-2 w-full" rows={2} placeholder="Observações"
                  value={form.observacoes} onChange={(e)=>setF("observacoes", e.target.value)} />
        <div className="flex justify-end">
          <button onClick={addRow} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Salvar plantio
          </button>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-2">
        <input className="border rounded px-3 py-2 w-full md:w-96" placeholder="Buscar por cultura, talhão, safra…"
               value={q} onChange={(e)=>setQ(e.target.value)} />
        <button onClick={fetchRows} className="px-3 py-2 rounded border">Atualizar</button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Cultura</th>
              <th className="p-2 text-left">Variedade</th>
              <th className="p-2 text-left">Safra</th>
              <th className="p-2 text-left">Talhão</th>
              <th className="p-2 text-right">Área (ha)</th>
              <th className="p-2 text-left">Data plantio</th>
              <th className="p-2 text-left">Espaçamento</th>
              <th className="p-2 text-right">População/ha</th>
              <th className="p-2 text-left">Obs.</th>
              <th className="p-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4 text-center" colSpan={10}>
                <span className="inline-flex items-center gap-2 text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </span>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="p-4 text-center text-slate-500" colSpan={10}>Nenhum plantio.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  {editId === r.id ? (
                    <>
                      <td className="p-2"><input className="border rounded px-2 py-1 w-full"
                        value={editRow.cultura||""} onChange={(e)=>setEditRow({...editRow, cultura:e.target.value})} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 w-full"
                        value={editRow.variedade||""} onChange={(e)=>setEditRow({...editRow, variedade:e.target.value})} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 w-full"
                        value={editRow.safra||""} onChange={(e)=>setEditRow({...editRow, safra:e.target.value})} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 w-full"
                        value={editRow.talhao||""} onChange={(e)=>setEditRow({...editRow, talhao:e.target.value})} /></td>
                      <td className="p-2 text-right"><input className="border rounded px-2 py-1 w-full text-right" type="number"
                        value={editRow.area_ha} onChange={(e)=>setEditRow({...editRow, area_ha:e.target.value})} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 w-full" type="date"
                        value={editRow.data_plantio||""} onChange={(e)=>setEditRow({...editRow, data_plantio:e.target.value})} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 w-full"
                        value={editRow.espacamento||""} onChange={(e)=>setEditRow({...editRow, espacamento:e.target.value})} /></td>
                      <td className="p-2 text-right"><input className="border rounded px-2 py-1 w-full text-right" type="number"
                        value={editRow.populacao_ha} onChange={(e)=>setEditRow({...editRow, populacao_ha:e.target.value})} /></td>
                      <td className="p-2"><input className="border rounded px-2 py-1 w-full"
                        value={editRow.observacoes||""} onChange={(e)=>setEditRow({...editRow, observacoes:e.target.value})} /></td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <button onClick={saveEdit} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-600 text-white">
                            <Save className="w-4 h-4" /> Salvar
                          </button>
                          <button onClick={cancelEdit} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-200">
                            <X className="w-4 h-4" /> Cancelar
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">{r.cultura}</td>
                      <td className="p-2">{r.variedade || "—"}</td>
                      <td className="p-2">{r.safra || "—"}</td>
                      <td className="p-2">{r.talhao || "—"}</td>
                      <td className="p-2 text-right">{r.area_ha ?? "—"}</td>
                      <td className="p-2">{r.data_plantio || "—"}</td>
                      <td className="p-2">{r.espacamento || "—"}</td>
                      <td className="p-2 text-right">{r.populacao_ha ?? "—"}</td>
                      <td className="p-2">{r.observacoes || "—"}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <button onClick={()=>startEdit(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded border">
                            <Edit3 className="w-4 h-4" /> Editar
                          </button>
                          <button onClick={()=>delRow(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white">
                            <Trash2 className="w-4 h-4" /> Excluir
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
