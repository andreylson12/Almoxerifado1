import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2, Trash2 } from "lucide-react";

export default function Colheita() {
  // filtros
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fCultura, setFCultura] = useState("");
  const [fTalhao, setFTalhao] = useState("");
  const [fPlantioId, setFPlantioId] = useState(""); // novo filtro por plantio

  // dados
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // plantios (para vincular e filtrar)
  const [plantios, setPlantios] = useState([]);

  // form novo registro
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    cultura: "",
    talhao: "",
    area_total_ha: "",
    placa: "",
    motorista: "",
    destino: "",
    ticket: "",
    peso_bruto_kg: "",
    tara_kg: "",
    observacoes: "",
    plantio_id: "", // NOVO
  });

  // config de sacas (p/ média sc/ha)
  const [kgPorSaca, setKgPorSaca] = useState(60);
  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const fetchPlantios = async () => {
    try {
      const { data, error } = await supabase
        .from("plantios")
        .select("id, cultura, talhao, safra, area_ha")
        .order("data_plantio", { ascending: false });
      if (error) throw error;
      setPlantios(data || []);
    } catch (err) {
      console.error(err);
      alert("Falha ao carregar plantios (para seleção).");
    }
  };

  const fetchCargas = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("colheita_cargas")
        .select("*")
        .order("data", { ascending: true })
        .order("id", { ascending: true });

      if (from) q = q.gte("data", from);
      if (to) q = q.lte("data", to);
      if (fCultura) q = q.ilike("cultura", `%${fCultura}%`);
      if (fTalhao) q = q.ilike("talhao", `%${fTalhao}%`);
      if (fPlantioId) q = q.eq("plantio_id", Number(fPlantioId));

      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      console.error(err);
      alert("Falha ao carregar cargas da colheita.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlantios();
    fetchCargas();
  }, []); // ao abrir

  const addCarga = async () => {
    try {
      const payload = {
        data: form.data || null,
        cultura: form.cultura || null,
        talhao: form.talhao || null,
        area_total_ha: form.area_total_ha ? Number(form.area_total_ha) : null,
        placa: form.placa || null,
        motorista: form.motorista || null,
        destino: form.destino || null,
        ticket: form.ticket || null,
        peso_bruto_kg: Number(form.peso_bruto_kg || 0),
        tara_kg: Number(form.tara_kg || 0),
        observacoes: form.observacoes || null,
        plantio_id: form.plantio_id ? Number(form.plantio_id) : null,
      };

      if (!payload.peso_bruto_kg || !payload.tara_kg) {
        return alert("Informe peso bruto e tara.");
      }
      if (payload.peso_bruto_kg <= payload.tara_kg) {
        return alert("Peso bruto deve ser maior que a tara.");
      }

      const { error } = await supabase.from("colheita_cargas").insert([payload]);
      if (error) throw error;

      // mantém cultura/talhão/área e plantio para facilitar lançamentos em sequência
      setForm({
        data: new Date().toISOString().slice(0, 10),
        cultura: form.cultura,
        talhao: form.talhao,
        area_total_ha: form.area_total_ha,
        placa: "",
        motorista: "",
        destino: "",
        ticket: "",
        peso_bruto_kg: "",
        tara_kg: "",
        observacoes: "",
        plantio_id: form.plantio_id,
      });
      fetchCargas();
    } catch (err) {
      console.error(err);
      alert("Falha ao salvar carga.");
    }
  };

  const delCarga = async (r) => {
    try {
      const ok = window.confirm(
        `Excluir a carga do dia ${r.data || "—"} (ticket ${r.ticket || "—"})?`
      );
      if (!ok) return;
      const { error } = await supabase
        .from("colheita_cargas")
        .delete()
        .eq("id", r.id);
      if (error) throw error;
      fetchCargas();
    } catch (err) {
      console.error(err);
      alert("Falha ao excluir carga.");
    }
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (from && r.data < from) return false;
      if (to && r.data > to) return false;
      if (fCultura && !(r.cultura || "").toLowerCase().includes(fCultura.toLowerCase())) return false;
      if (fTalhao && !(r.talhao || "").toLowerCase().includes(fTalhao.toLowerCase())) return false;
      if (fPlantioId && Number(r.plantio_id) !== Number(fPlantioId)) return false;
      return true;
    });
  }, [rows, from, to, fCultura, fTalhao, fPlantioId]);

  // cálculos
  const totBruto = filtered.reduce((s, r) => s + Number(r.peso_bruto_kg || 0), 0);
  const totTara  = filtered.reduce((s, r) => s + Number(r.tara_kg || 0), 0);
  const totLiq   = filtered.reduce(
    (s, r) => s + Number((r.peso_liquido_kg ?? (Number(r.peso_bruto_kg||0) - Number(r.tara_kg||0))) || 0),
    0
  );

  // área de referência (se filtrar por plantio, usa área do plantio; senão usa maior área das cargas ou o form)
  const plantioSel = plantios.find(p => p.id === Number(fPlantioId));
  const areaRef =
    (plantioSel?.area_ha
      ?? Math.max(0, ...filtered.map((r) => Number(r.area_total_ha || 0)))
      ?? 0)
    || Number(form.area_total_ha || 0)
    || 0;

  const mediaKgHa = areaRef > 0 ? totLiq / areaRef : 0;
  const mediaScHa = kgPorSaca > 0 ? mediaKgHa / kgPorSaca : 0;

  return (
    <div className="space-y-4">
      {/* Filtros e resumo */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          <input type="date" className="border rounded px-3 py-2" value={from} onChange={(e)=>setFrom(e.target.value)} />
          <input type="date" className="border rounded px-3 py-2" value={to} onChange={(e)=>setTo(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Cultura (ex: Soja)" value={fCultura} onChange={(e)=>setFCultura(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Talhão" value={fTalhao} onChange={(e)=>setFTalhao(e.target.value)} />

          <select className="border rounded px-3 py-2" value={fPlantioId} onChange={(e)=>setFPlantioId(e.target.value)}>
            <option value="">Plantio (todos)</option>
            {plantios.map(p => (
              <option key={p.id} value={p.id}>
                {p.cultura} • {p.talhao || "—"} {p.safra ? `• ${p.safra}` : ""} {p.area_ha ? `• ${p.area_ha} ha` : ""}
              </option>
            ))}
          </select>

          <button onClick={fetchCargas} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded">
            Atualizar
          </button>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">kg/saca</label>
            <input type="number" className="border rounded px-2 py-1 w-24"
              value={kgPorSaca} onChange={(e)=>setKgPorSaca(Number(e.target.value || 0))} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500">Cargas</div>
            <div className="text-lg font-semibold">{filtered.length}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500">Total Bruto (kg)</div>
            <div className="text-lg font-semibold">{totBruto.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500">Total Tara (kg)</div>
            <div className="text-lg font-semibold">{totTara.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500">Total Líquido (kg)</div>
            <div className="text-lg font-semibold">{totLiq.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500">Área ref. (ha)</div>
            <div className="text-lg font-semibold">{areaRef || "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-green-50 rounded">
            <div className="text-slate-600">Média (kg/ha)</div>
            <div className="text-xl font-semibold text-green-700">
              {mediaKgHa ? mediaKgHa.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded">
            <div className="text-slate-600">Média (sc/ha)</div>
            <div className="text-xl font-semibold text-indigo-700">
              {mediaScHa ? mediaScHa.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Formulário de lançamento */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <h3 className="font-semibold">Lançar carga</h3>

        {/* Seleção de plantio (preenche cultura/talhão/área automaticamente se desejar) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select className="border rounded px-3 py-2"
            value={form.plantio_id}
            onChange={(e) => {
              const v = e.target.value;
              setF("plantio_id", v);
              const p = plantios.find((x)=>x.id === Number(v));
              if (p) {
                if (!form.cultura) setF("cultura", p.cultura || "");
                if (!form.talhao) setF("talhao", p.talhao || "");
                if (!form.area_total_ha && p.area_ha) setF("area_total_ha", String(p.area_ha));
              }
            }}>
            <option value="">Vincular a um plantio (opcional)</option>
            {plantios.map(p => (
              <option key={p.id} value={p.id}>
                {p.cultura} • {p.talhao || "—"} {p.safra ? `• ${p.safra}` : ""} {p.area_ha ? `• ${p.area_ha} ha` : ""}
              </option>
            ))}
          </select>

          <input type="date" className="border rounded px-3 py-2"
                 value={form.data} onChange={(e)=>setF("data", e.target.value)} />

          <input className="border rounded px-3 py-2" placeholder="Área total (ha)" type="number"
                 value={form.area_total_ha} onChange={(e)=>setF("area_total_ha", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Cultura"
                 value={form.cultura} onChange={(e)=>setF("cultura", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Talhão"
                 value={form.talhao} onChange={(e)=>setF("talhao", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Placa"
                 value={form.placa} onChange={(e)=>setF("placa", e.target.value.toUpperCase())} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Motorista"
                 value={form.motorista} onChange={(e)=>setF("motorista", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Destino"
                 value={form.destino} onChange={(e)=>setF("destino", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Ticket"
                 value={form.ticket} onChange={(e)=>setF("ticket", e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Peso bruto (kg)" type="number"
                 value={form.peso_bruto_kg} onChange={(e)=>setF("peso_bruto_kg", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Tara (kg)" type="number"
                 value={form.tara_kg} onChange={(e)=>setF("tara_kg", e.target.value)} />
          <input className="border rounded px-3 py-2 bg-slate-50" readOnly
            value={
              form.peso_bruto_kg && form.tara_kg
                ? Math.max(0, Number(form.peso_bruto_kg) - Number(form.tara_kg))
                : ""
            }
            placeholder="Líquido (kg)" title="Calculado automaticamente (bruto - tara)" />
        </div>

        <textarea className="border rounded px-3 py-2 w-full" rows={2}
          placeholder="Observações"
          value={form.observacoes} onChange={(e)=>setF("observacoes", e.target.value)} />

        <div className="flex justify-end">
          <button onClick={addCarga} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Lançar
          </button>
        </div>
      </div>

      {/* Tabela de cargas */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-left">Plantio</th>
              <th className="p-2 text-left">Cultura</th>
              <th className="p-2 text-left">Talhão</th>
              <th className="p-2 text-left">Área total (ha)</th>
              <th className="p-2 text-left">Placa</th>
              <th className="p-2 text-left">Motorista</th>
              <th className="p-2 text-right">Bruto (kg)</th>
              <th className="p-2 text-right">Tara (kg)</th>
              <th className="p-2 text-right">Líquido (kg)</th>
              <th className="p-2 text-left">Destino</th>
              <th className="p-2 text-left">Ticket</th>
              <th className="p-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-center" colSpan={13}>
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                  </span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr><td className="p-4 text-center text-slate-500" colSpan={13}>Nenhuma carga.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.data}</td>
                  <td className="p-2">
                    {r.plantio_id
                      ? (() => {
                          const p = plantios.find(x => x.id === r.plantio_id);
                          return p ? `${p.cultura} • ${p.talhao || "—"} ${p.safra ? "• "+p.safra : ""}` : r.plantio_id;
                        })()
                      : "—"}
                  </td>
                  <td className="p-2">{r.cultura || "—"}</td>
                  <td className="p-2">{r.talhao || "—"}</td>
                  <td className="p-2">{r.area_total_ha ?? "—"}</td>
                  <td className="p-2">{r.placa || "—"}</td>
                  <td className="p-2">{r.motorista || "—"}</td>
                  <td className="p-2 text-right">{Number(r.peso_bruto_kg || 0).toLocaleString()}</td>
                  <td className="p-2 text-right">{Number(r.tara_kg || 0).toLocaleString()}</td>
                  <td className="p-2 text-right">
                    {Number((r.peso_liquido_kg ?? (Number(r.peso_bruto_kg||0) - Number(r.tara_kg||0))) || 0).toLocaleString()}
                  </td>
                  <td className="p-2">{r.destino || "—"}</td>
                  <td className="p-2">{r.ticket || "—"}</td>
                  <td className="p-2">
                    <button
                      onClick={()=>delCarga(r)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white"
                    >
                      <Trash2 className="w-4 h-4" /> Excluir
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
