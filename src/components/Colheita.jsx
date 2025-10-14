import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2, Trash2 } from "lucide-react";

export default function Colheita() {
  /* ===== Fazendas & filtros ===== */
  const [fazendas, setFazendas] = useState([]);
  const [fazendaId, setFazendaId] = useState("");

  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [fCultura, setFCultura] = useState("");
  const [fTalhao, setFTalhao] = useState("");
  const [kgPorSaca, setKgPorSaca] = useState(60);

  /* ===== Plantios para a fazenda ===== */
  const [plantios, setPlantios] = useState([]);

  /* ===== Colheitas (listagem) ===== */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ===== Form nova carga ===== */
  const [form, setForm] = useState({
    plantio_id: "",
    data: new Date().toISOString().slice(0, 10),
    area_total_ha: "",
    cultura: "",
    talhao: "",
    placa: "",
    motorista: "",
    destino: "",
    ticket: "",
    tara_kg: "",
    bruto_kg: "",
  });

  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  /* ===== Loads ===== */
  const fetchFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from("fazendas")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      setFazendas(data || []);
      if (!fazendaId && data?.length) setFazendaId(String(data[0].id));
    } catch (e) {
      console.error(e);
      alert("Falha ao carregar fazendas.");
    }
  };

  const fetchPlantios = async (fid) => {
    try {
      if (!fid) {
        setPlantios([]);
        return;
      }
      const { data, error } = await supabase
        .from("plantios")
        .select("*")
        .eq("fazenda_id", Number(fid))
        .order("data_plantio", { ascending: false });
      if (error) throw error;
      setPlantios(data || []);
    } catch (e) {
      console.error(e);
      alert("Falha ao carregar plantios.");
    }
  };

  const fetchColheitas = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("colheitas")
        .select("*")
        .order("data", { ascending: false });

      if (fazendaId) q = q.eq("fazenda_id", Number(fazendaId));
      if (inicio) q = q.gte("data", inicio);
      if (fim) q = q.lte("data", fim);
      if (fCultura) q = q.ilike("cultura", `%${fCultura}%`);
      if (fTalhao) q = q.ilike("talhao", `%${fTalhao}%`);

      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error(e);
      alert("Falha ao carregar colheitas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFazendas();
  }, []);

  useEffect(() => {
    if (fazendaId) {
      fetchPlantios(fazendaId);
      fetchColheitas();
    }
  }, [fazendaId]);

  /* refazer listagem quando filtros mudam */
  useEffect(() => {
    fetchColheitas();
  }, [inicio, fim, fCultura, fTalhao]);

  /* ===== Derivados (cards) ===== */
  const totais = useMemo(() => {
    const bruto = rows.reduce((s, r) => s + Number(r.bruto_kg || 0), 0);
    const tara = rows.reduce((s, r) => s + Number(r.tara_kg || 0), 0);
    const liquido = bruto - tara;

    // área de referência: se usuário seleciona um plantio para lançar, usamos área desse plantio.
    // Para os cards (listagem geral), usamos a SOMA de "area_total_ha" das cargas (se informada),
    // senão usamos area do plantio vinculado (quando existir) para estimar a média.
    let areaRef = 0;
    for (const r of rows) {
      const areaCarga = Number(r.area_total_ha || 0);
      if (areaCarga > 0) areaRef += areaCarga;
      else if (r.plantio_id) {
        const p = plantios.find((x) => x.id === r.plantio_id);
        if (p?.area_ha) areaRef += Number(p.area_ha);
      }
    }

    const mediaKgHa = areaRef > 0 ? liquido / areaRef : null;
    const mediaScHa =
      mediaKgHa && Number(kgPorSaca) > 0 ? mediaKgHa / Number(kgPorSaca) : null;

    return { bruto, tara, liquido, areaRef, mediaKgHa, mediaScHa };
  }, [rows, plantios, kgPorSaca]);

  /* ===== ao escolher plantio no form, pré-preenche cultura/talhão/area ===== */
  useEffect(() => {
    if (!form.plantio_id) return;
    const p = plantios.find((x) => String(x.id) === String(form.plantio_id));
    if (p) {
      setF("cultura", p.cultura || "");
      setF("talhao", p.talhao || "");
      // se ainda não informou área, sugere do plantio
      if (!form.area_total_ha) setF("area_total_ha", p.area_ha ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.plantio_id]);

  /* ===== salvar carga ===== */
  const salvar = async () => {
    try {
      if (!fazendaId) return alert("Selecione a fazenda.");
      if (!form.data) return alert("Informe a data.");
      if (!form.bruto_kg) return alert("Informe o peso bruto (kg).");
      if (!form.tara_kg) return alert("Informe a tara (kg).");

      const payload = {
        fazenda_id: Number(fazendaId),
        plantio_id: form.plantio_id ? Number(form.plantio_id) : null,
        data: form.data,
        cultura: form.cultura || null,
        talhao: form.talhao || null,
        area_total_ha: form.area_total_ha ? Number(form.area_total_ha) : null,
        placa: form.placa || null,
        motorista: form.motorista || null,
        destino: form.destino || null,
        ticket: form.ticket || null,
        bruto_kg: Number(form.bruto_kg),
        tara_kg: Number(form.tara_kg),
      };

      const { error } = await supabase.from("colheitas").insert([payload]);
      if (error) throw error;

      setForm((s) => ({
        ...s,
        placa: "",
        motorista: "",
        destino: "",
        ticket: "",
        bruto_kg: "",
        tara_kg: "",
      }));
      fetchColheitas();
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar carga.");
    }
  };

  const excluir = async (row) => {
    if (!confirm("Excluir esta carga?")) return;
    try {
      const { error } = await supabase.from("colheitas").delete().eq("id", row.id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      console.error(e);
      alert("Falha ao excluir carga.");
    }
  };

  return (
    <div className="space-y-5">
      {/* ===== Filtros/Topo ===== */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-9 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="text-xs text-slate-500">Fazenda</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={fazendaId}
              onChange={(e) => setFazendaId(e.target.value)}
            >
              {fazendas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">Início</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Fim</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Cultura</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="ex: Soja"
              value={fCultura}
              onChange={(e) => setFCultura(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Talhão</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="ex: T-01"
              value={fTalhao}
              onChange={(e) => setFTalhao(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">kg/saca</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={kgPorSaca}
              onChange={(e) => setKgPorSaca(e.target.value)}
            />
          </div>

          <div className="flex">
            <button
              onClick={fetchColheitas}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full"
            >
              Atualizar
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500 text-sm">Cargas</div>
            <div className="text-2xl font-semibold">{rows.length}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500 text-sm">Total Bruto (kg)</div>
            <div className="text-2xl font-semibold">
              {totais.bruto.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500 text-sm">Total Tara (kg)</div>
            <div className="text-2xl font-semibold">
              {totais.tara.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500 text-sm">Total Líquido (kg)</div>
            <div className="text-2xl font-semibold">
              {totais.liquido.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500 text-sm">Área ref. (ha)</div>
            <div className="text-2xl font-semibold">
              {totais.areaRef
                ? totais.areaRef.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : "—"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-emerald-50 rounded">
            <div className="text-slate-600 text-sm">Média (kg/ha)</div>
            <div className="text-2xl font-semibold">
              {totais.mediaKgHa
                ? totais.mediaKgHa.toLocaleString(undefined, { maximumFractionDigits: 1 })
                : "—"}
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded">
            <div className="text-slate-600 text-sm">Média (sc/ha)</div>
            <div className="text-2xl font-semibold">
              {totais.mediaScHa
                ? totais.mediaScHa.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Lançar carga ===== */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <h3 className="font-semibold text-lg">Lançar carga</h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Vincular a um plantio (opcional) */}
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Vincular a um plantio (opcional)</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.plantio_id}
              onChange={(e) => setF("plantio_id", e.target.value)}
            >
              <option value="">— sem vínculo —</option>
              {plantios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.safra ? `${p.safra} • ` : ""}{p.cultura || "?"} • {p.talhao || "?"}{p.area_ha ? ` • ${p.area_ha} ha` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">Data</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={form.data}
              onChange={(e) => setF("data", e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Área total (ha)</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              placeholder="Área para cálculo de média"
              value={form.area_total_ha}
              onChange={(e) => setF("area_total_ha", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500">Cultura</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.cultura}
              onChange={(e) => setF("cultura", e.target.value)}
              placeholder="Se vazio, usará do plantio"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Talhão</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.talhao}
              onChange={(e) => setF("talhao", e.target.value)}
              placeholder="Se vazio, usará do plantio"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Placa</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.placa}
              onChange={(e) => setF("placa", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Motorista</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.motorista}
              onChange={(e) => setF("motorista", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500">Destino</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.destino}
              onChange={(e) => setF("destino", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Ticket</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.ticket}
              onChange={(e) => setF("ticket", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Tara (kg)</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={form.tara_kg}
              onChange={(e) => setF("tara_kg", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Bruto (kg)</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={form.bruto_kg}
              onChange={(e) => setF("bruto_kg", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={salvar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
          >
            Salvar carga
          </button>
        </div>
      </div>

      {/* ===== Tabela ===== */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-left">Cultura</th>
              <th className="p-2 text-left">Talhão</th>
              <th className="p-2 text-right">Tara (kg)</th>
              <th className="p-2 text-right">Bruto (kg)</th>
              <th className="p-2 text-right">Líquido (kg)</th>
              <th className="p-2 text-right">Área (ha)</th>
              <th className="p-2 text-left">Placa</th>
              <th className="p-2 text-left">Motorista</th>
              <th className="p-2 text-left">Destino</th>
              <th className="p-2 text-left">Ticket</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="p-4 text-center">
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-4 text-center text-slate-500">
                  Nenhuma carga.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const liquido = Number(r.bruto_kg || 0) - Number(r.tara_kg || 0);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.data || "—"}</td>
                    <td className="p-2">{r.cultura || "—"}</td>
                    <td className="p-2">{r.talhao || "—"}</td>
                    <td className="p-2 text-right">{Number(r.tara_kg || 0).toLocaleString()}</td>
                    <td className="p-2 text-right">{Number(r.bruto_kg || 0).toLocaleString()}</td>
                    <td className="p-2 text-right">{liquido.toLocaleString()}</td>
                    <td className="p-2 text-right">
                      {r.area_total_ha
                        ? Number(r.area_total_ha).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="p-2">{r.placa || "—"}</td>
                    <td className="p-2">{r.motorista || "—"}</td>
                    <td className="p-2">{r.destino || "—"}</td>
                    <td className="p-2">{r.ticket || "—"}</td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => excluir(r)}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
