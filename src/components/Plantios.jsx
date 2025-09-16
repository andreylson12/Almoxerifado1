import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2, Trash2 } from "lucide-react";

export default function Plantios() {
  // Talhões
  const [talhoes, setTalhoes] = useState([]);
  const [tLoading, setTLoading] = useState(false);
  const [tForm, setTForm] = useState({ nome: "", area_ha: "" });

  // Safras
  const [safras, setSafras] = useState([]);
  const [sLoading, setSLoading] = useState(false);
  const [sForm, setSForm] = useState({
    cultura: "",
    talhao_id: "",
    data_plantio: new Date().toISOString().slice(0,10),
    area_ha: "",
    variedade: "",
    meta_sc_ha: "",
    status: "em_andamento",
  });

  const loadTalhoes = async () => {
    setTLoading(true);
    try {
      const { data, error } = await supabase
        .from("talhoes")
        .select("*")
        .order("id", { ascending: true });
      if (error) throw error;
      setTalhoes(data || []);
    } catch (e) {
      console.error(e);
      alert("Falha ao carregar talhões.");
    } finally {
      setTLoading(false);
    }
  };

  const loadSafras = async () => {
    setSLoading(true);
    try {
      // busca safras e junta o nome do talhão
      const { data, error } = await supabase
        .from("safras")
        .select("*, talhao:talhoes ( id, nome )")
        .order("id", { ascending: true });
      if (error) throw error;
      setSafras(data || []);
    } catch (e) {
      console.error(e);
      alert("Falha ao carregar safras.");
    } finally {
      setSLoading(false);
    }
  };

  useEffect(() => {
    loadTalhoes();
    loadSafras();
  }, []);

  // ------- Talhões: add / delete -------
  const addTalhao = async () => {
    try {
      const payload = {
        nome: (tForm.nome || "").trim(),
        area_ha: tForm.area_ha ? Number(tForm.area_ha) : null,
      };
      if (!payload.nome) return alert("Informe o nome do talhão.");
      const { error } = await supabase.from("talhoes").insert([payload]);
      if (error) throw error;
      setTForm({ nome: "", area_ha: "" });
      loadTalhoes();
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar talhão.");
    }
  };

  const delTalhao = async (row) => {
    if (!row?.id) return;
    if (!confirm(`Excluir talhão "${row.nome}"? (Safras vinculadas ficarão sem talhão)`)) return;
    try {
      const { error } = await supabase.from("talhoes").delete().eq("id", row.id);
      if (error) throw error;
      loadTalhoes();
      loadSafras(); // pode impactar listagem
    } catch (e) {
      console.error(e);
      alert("Falha ao excluir talhão.");
    }
  };

  // ------- Safras: add / delete -------
  const addSafra = async () => {
    try {
      const payload = {
        cultura: (sForm.cultura || "").trim(),
        talhao_id: sForm.talhao_id ? Number(sForm.talhao_id) : null,
        data_plantio: sForm.data_plantio || null,
        area_ha: sForm.area_ha ? Number(sForm.area_ha) : null,
        variedade: sForm.variedade || null,
        meta_sc_ha: sForm.meta_sc_ha ? Number(sForm.meta_sc_ha) : null,
        status: sForm.status || "em_andamento",
      };
      if (!payload.cultura) return alert("Informe a cultura.");
      // se não informar area_ha, tenta puxar do talhão selecionado
      if (!payload.area_ha && payload.talhao_id) {
        const talhao = talhoes.find(t => t.id === payload.talhao_id);
        if (talhao?.area_ha) payload.area_ha = Number(talhao.area_ha);
      }

      const { error } = await supabase.from("safras").insert([payload]);
      if (error) throw error;

      setSForm({
        cultura: sForm.cultura,
        talhao_id: sForm.talhao_id,
        data_plantio: new Date().toISOString().slice(0,10),
        area_ha: sForm.area_ha,
        variedade: "",
        meta_sc_ha: sForm.meta_sc_ha,
        status: "em_andamento",
      });
      loadSafras();
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar safra.");
    }
  };

  const delSafra = async (row) => {
    if (!row?.id) return;
    if (!confirm(`Excluir safra ${row.cultura} (#${row.id})? (cargas vinculadas perderão o vínculo)`)) return;
    try {
      const { error } = await supabase.from("safras").delete().eq("id", row.id);
      if (error) throw error;
      loadSafras();
    } catch (e) {
      console.error(e);
      alert("Falha ao excluir safra.");
    }
  };

  return (
    <div className="space-y-6">
      {/* TALHÕES */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <h3 className="font-semibold">Talhões</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Nome do talhão"
            value={tForm.nome}
            onChange={(e)=>setTForm(s=>({...s, nome: e.target.value}))}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Área (ha)"
            type="number"
            value={tForm.area_ha}
            onChange={(e)=>setTForm(s=>({...s, area_ha: e.target.value}))}
          />
          <button onClick={addTalhao} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Salvar talhão
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full bg-white">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Área (ha)</th>
                <th className="p-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tLoading ? (
                <tr><td className="p-4 text-center" colSpan={4}><span className="inline-flex items-center gap-2 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</span></td></tr>
              ) : talhoes.length === 0 ? (
                <tr><td className="p-4 text-center text-slate-500" colSpan={4}>Nenhum talhão cadastrado.</td></tr>
              ) : (
                talhoes.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{t.id}</td>
                    <td className="p-2">{t.nome}</td>
                    <td className="p-2">{t.area_ha ?? "—"}</td>
                    <td className="p-2">
                      <button onClick={()=>delTalhao(t)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
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

      {/* SAFRAS / PLANTIOS */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <h3 className="font-semibold">Safras / Plantios</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Cultura (ex: Soja)"
            value={sForm.cultura}
            onChange={(e)=>setSForm(s=>({...s, cultura: e.target.value}))}
          />
          <select
            className="border rounded px-3 py-2"
            value={sForm.talhao_id}
            onChange={(e)=>setSForm(s=>({...s, talhao_id: e.target.value}))}
          >
            <option value="">(Sem talhão)</option>
            {talhoes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={sForm.data_plantio}
            onChange={(e)=>setSForm(s=>({...s, data_plantio: e.target.value}))}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Área (ha)"
            type="number"
            value={sForm.area_ha}
            onChange={(e)=>setSForm(s=>({...s, area_ha: e.target.value}))}
            title="Se vazio, usaremos a área do talhão (se existir)."
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Variedade"
            value={sForm.variedade}
            onChange={(e)=>setSForm(s=>({...s, variedade: e.target.value}))}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Meta (sc/ha)"
            type="number"
            value={sForm.meta_sc_ha}
            onChange={(e)=>setSForm(s=>({...s, meta_sc_ha: e.target.value}))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            className="border rounded px-3 py-2"
            value={sForm.status}
            onChange={(e)=>setSForm(s=>({...s, status: e.target.value}))}
          >
            <option value="em_andamento">Em andamento</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <div className="md:col-span-5 flex justify-end">
            <button onClick={addSafra} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
              Salvar safra
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full bg-white">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Cultura</th>
                <th className="p-2 text-left">Talhão</th>
                <th className="p-2 text-left">Área (ha)</th>
                <th className="p-2 text-left">Plantio</th>
                <th className="p-2 text-left">Variedade</th>
                <th className="p-2 text-left">Meta (sc/ha)</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sLoading ? (
                <tr><td className="p-4 text-center" colSpan={9}><span className="inline-flex items-center gap-2 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</span></td></tr>
              ) : safras.length === 0 ? (
                <tr><td className="p-4 text-center text-slate-500" colSpan={9}>Nenhuma safra cadastrada.</td></tr>
              ) : (
                safras.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.id}</td>
                    <td className="p-2">{s.cultura}</td>
                    <td className="p-2">{s.talhao?.nome || "—"}</td>
                    <td className="p-2">{s.area_ha ?? "—"}</td>
                    <td className="p-2">{s.data_plantio || "—"}</td>
                    <td className="p-2">{s.variedade || "—"}</td>
                    <td className="p-2">{s.meta_sc_ha ?? "—"}</td>
                    <td className="p-2">{s.status || "—"}</td>
                    <td className="p-2">
                      <button onClick={()=>delSafra(s)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
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
    </div>
  );
}
