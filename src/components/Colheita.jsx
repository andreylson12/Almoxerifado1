// src/components/Colheita.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2, Trash2 } from "lucide-react";

export default function Colheita() {
  // fazenda selecionada no topo
  const [fazendas, setFazendas] = useState([]);
  const [fazendaId, setFazendaId] = useState("");

  // listas
  const [talhoes, setTalhoes] = useState([]);
  const [plantios, setPlantios] = useState([]);
  const [colheitas, setColheitas] = useState([]);

  const [loading, setLoading] = useState(false);

  // filtros do cabeçalho (exibição de cards/estatísticas)
  const [fDataIni, setFDataIni] = useState("");
  const [fDataFim, setFDataFim] = useState("");
  const [fCultura, setFCultura] = useState("");
  const [fTalhao, setFTalhao] = useState("");
  const [kgPorSaca, setKgPorSaca] = useState(60);

  // formulário de nova carga
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    plantio_id: "",       // será preenchido automaticamente
    cultura: "",
    talhao: "",
    area_total_ha: "",
    placa: "",
    motorista: "",
    destino: "",
    ticket: "",
    bruto_kg: "",
    tara_kg: "",
  });
  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  /* =========================
   * Fetch básico
   * ========================= */
  const fetchFazendas = async () => {
    const { data, error } = await supabase.from("fazendas").select("*").order("nome");
    if (!error) {
      setFazendas(data || []);
      if (!fazendaId && data?.length) setFazendaId(String(data[0].id));
    }
  };

  const fetchTalhoes = async (fid) => {
    if (!fid) {
      setTalhoes([]);
      return;
    }
    const { data, error } = await supabase
      .from("talhoes")
      .select("*")
      .eq("fazenda_id", fid)
      .order("nome");
    if (!error) setTalhoes(data || []);
  };

  const fetchPlantios = async (fid) => {
    if (!fid) {
      setPlantios([]);
      return;
    }
    const { data, error } = await supabase
      .from("plantios")
      .select("*")
      .eq("fazenda_id", fid)
      .order("data_plantio", { ascending: false })
      .order("id", { ascending: false });
    if (!error) setPlantios(data || []);
  };

  const fetchColheitas = async () => {
    if (!fazendaId) {
      setColheitas([]);
      return;
    }
    setLoading(true);
    try {
      let q = supabase
        .from("colheitas")
        .select("*")
        .eq("fazenda_id", fazendaId)
        .order("data", { ascending: false })
        .order("id", { ascending: false });

      if (fDataIni) q = q.gte("data", fDataIni);
      if (fDataFim) q = q.lte("data", fDataFim);
      if (fCultura) q = q.ilike("cultura", `%${fCultura}%`);
      if (fTalhao) q = q.ilike("talhao", `%${fTalhao}%`);

      const { data, error } = await q;
      if (error) throw error;
      setColheitas(data || []);
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
    if (!fazendaId) return;
    fetchTalhoes(fazendaId);
    fetchPlantios(fazendaId);
    fetchColheitas();
  }, [fazendaId]);

  /* =========================
   * Auto-vincular plantio
   * ========================= */
  // acha o "plantio vigente" para talhão/fazenda na data da colheita
  const findMatchingPlantio = (talhaoNome, dataColheitaISO) => {
    if (!talhaoNome || !dataColheitaISO) return null;
    // filtra plantios do mesmo talhão e fazenda
    const list = plantios
      .filter((p) => (p.talhao || "").toLowerCase() === talhaoNome.toLowerCase())
      .sort((a, b) => new Date(b.data_plantio) - new Date(a.data_plantio));

    // regra simples: o mais recente com data_plantio <= data da carga
    const dataCarga = new Date(dataColheitaISO);
    for (const p of list) {
      const dPlant = p.data_plantio ? new Date(p.data_plantio) : null;
      if (!dPlant) continue;
      if (dPlant <= dataCarga) return p;
    }
    // se nenhum for anterior, tentamos o mais recente mesmo (último recurso)
    return list[0] || null;
  };

  // quando mudar talhão ou data → auto-preenche plantio
  useEffect(() => {
    if (!fazendaId) return;

    const p = findMatchingPlantio(form.talhao, form.data);
    if (p) {
      setF("plantio_id", p.id);
      if (!form.cultura) setF("cultura", p.cultura || "");
      if (!form.area_total_ha) setF("area_total_ha", p.area_ha ?? "");
    } else {
      // não achou plantio compatível
      setF("plantio_id", "");
      // cultura/área ficam como estão; pode ser preenchido manualmente
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.talhao, form.data, plantios, fazendaId]);

  /* =========================
   * Salvar / excluir
   * ========================= */
  const salvarCarga = async () => {
    try {
      if (!fazendaId) return alert("Selecione a fazenda.");
      if (!form.data) return alert("Informe a data.");
      if (!form.talhao) return alert("Informe o talhão.");
      if (!form.bruto_kg) return alert("Informe o peso bruto (kg).");

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
        bruto_kg: form.bruto_kg ? Number(form.bruto_kg) : null,
        tara_kg: form.tara_kg ? Number(form.tara_kg) : 0,
      };

      const { error } = await supabase.from("colheitas").insert([payload]);
      if (error) throw error;

      // limpa alguns campos
      setForm((s) => ({
        ...s,
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

  const excluirCarga = async (row) => {
    if (!confirm("Excluir esta carga?")) return;
    try {
      const { error } = await supabase.from("colheitas").delete().eq("id", row.id);
      if (error) throw error;
      fetchColheitas();
    } catch (e) {
      console.error(e);
      alert("Falha ao excluir carga.");
    }
  };

  /* =========================
   * Cálculos simples
   * ========================= */
  const colheitasFiltradas = useMemo(() => colheitas, [colheitas]);

  const totalBruto = colheitasFiltradas.reduce((s, r) => s + Number(r.bruto_kg || 0), 0);
  const totalTara = colheitasFiltradas.reduce((s, r) => s + Number(r.tara_kg || 0), 0);
  const totalLiquido = totalBruto - totalTara;

  const areaRef = useMemo(() => {
    // se quiser usar a maior ou soma da área, ajuste a regra:
    // aqui eu somo a área total informada nas cargas (se houver)
    const soma = colheitasFiltradas.reduce((s, r) => s + Number(r.area_total_ha || 0), 0);
    return soma || null;
  }, [colheitasFiltradas]);

  const mediaKgHa = areaRef ? totalLiquido / areaRef : null;
  const mediaScHa = mediaKgHa && kgPorSaca > 0 ? mediaKgHa / kgPorSaca : null;

  /* =========================
   * UI
   * ========================= */
  return (
    <div className="space-y-5">
      {/* Cabeçalho / filtros */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            className="border rounded px-3 py-2"
            value={fazendaId}
            onChange={(e) => setFazendaId(e.target.value)}
          >
            {fazendas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="border rounded px-3 py-2"
            value={fDataIni}
            onChange={(e) => setFDataIni(e.target.value)}
            placeholder="Data inicial"
          />
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={fDataFim}
            onChange={(e) => setFDataFim(e.target.value)}
            placeholder="Data final"
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Cultura (ex: Soja)"
            value={fCultura}
            onChange={(e) => setFCultura(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Talhão (ex: T-01)"
            value={fTalhao}
            onChange={(e) => setFTalhao(e.target.value)}
          />

          <div className="flex gap-2">
            <button
              onClick={fetchColheitas}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Atualizar
            </button>
            <div className="flex items-center gap-2 border rounded px-3 py-2">
              <span className="text-sm text-slate-600">kg/saca</span>
              <input
                type="number"
                className="w-16 outline-none"
                value={kgPorSaca}
                onChange={(e) => setKgPorSaca(Number(e.target.value || 0))}
              />
            </div>
          </div>
        </div>

        {/* cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500 text-sm">Cargas</div>
            <div className="text-xl font-semibold">{colheitasFiltradas.length}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500 text-sm">Total Bruto (kg)</div>
            <div className="text-xl font-semibold">
              {totalBruto.toLocaleString(undefined)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500 text-sm">Total Líquido (kg)</div>
            <div className="text-xl font-semibold">
              {totalLiquido.toLocaleString(undefined)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="text-slate-500 text-sm">Área ref. (ha)</div>
            <div className="text-xl font-semibold">
              {areaRef ? areaRef.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-emerald-50 rounded">
            <div className="text-slate-600 text-sm">Média (kg/ha)</div>
            <div className="text-xl font-semibold">
              {mediaKgHa ? mediaKgHa.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded">
            <div className="text-slate-600 text-sm">Média (sc/ha)</div>
            <div className="text-xl font-semibold">
              {mediaScHa ? mediaScHa.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Lançar carga */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <h3 className="font-semibold text-lg">Lançar carga</h3>

        {/* seletor manual de plantio (opcional) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            className="border rounded px-3 py-2"
            value={form.plantio_id || ""}
            onChange={(e) => {
              const v = e.target.value;
              setF("plantio_id", v || "");
              const p = plantios.find((x) => String(x.id) === String(v));
              if (p) {
                setF("cultura", p.cultura || "");
                setF("talhao", p.talhao || "");
                setF("area_total_ha", p.area_ha ?? "");
              }
            }}
          >
            <option value="">Vincular a um plantio (opcional)</option>
            {plantios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.data_plantio} • {p.cultura || "—"} • {p.talhao || "—"} •{" "}
                {p.area_ha ? `${p.area_ha} ha` : "—"}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="border rounded px-3 py-2"
            value={form.data}
            onChange={(e) => setF("data", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Área total (ha)"
            value={form.area_total_ha}
            onChange={(e) => setF("area_total_ha", e.target.value)}
          />
        </div>

        {/* cultura / talhão / observações */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Cultura"
            value={form.cultura}
            onChange={(e) => setF("cultura", e.target.value)}
          />
          <select
            className="border rounded px-3 py-2"
            value={form.talhao}
            onChange={(e) => setF("talhao", e.target.value)}
          >
            <option value="">Selecione o talhão…</option>
            {talhoes.map((t) => (
              <option key={t.id} value={t.nome}>
                {t.nome} {t.area_ha ? `• ${t.area_ha} ha` : ""}
              </option>
            ))}
          </select>
          <input
            className="border rounded px-3 py-2"
            placeholder="Observações / destino"
            value={form.destino}
            onChange={(e) => setF("destino", e.target.value)}
          />
        </div>

        {/* motorista / placa / ticket */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Motorista"
            value={form.motorista}
            onChange={(e) => setF("motorista", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Placa"
            value={form.placa}
            onChange={(e) => setF("placa", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Ticket"
            value={form.ticket}
            onChange={(e) => setF("ticket", e.target.value)}
          />
        </div>

        {/* pesos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Peso bruto (kg)"
            type="number"
            value={form.bruto_kg}
            onChange={(e) => setF("bruto_kg", e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Tara (kg)"
            type="number"
            value={form.tara_kg}
            onChange={(e) => setF("tara_kg", e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={salvarCarga}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
          >
            Salvar
          </button>
        </div>
      </div>

      {/* tabela */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-left">Cultura</th>
              <th className="p-2 text-left">Talhão</th>
              <th className="p-2 text-right">Área (ha)</th>
              <th className="p-2 text-right">Bruto (kg)</th>
              <th className="p-2 text-right">Tara (kg)</th>
              <th className="p-2 text-right">Líquido (kg)</th>
              <th className="p-2 text-left">Plantio</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-center" colSpan={9}>
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                  </span>
                </td>
              </tr>
            ) : colheitasFiltradas.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={9}>
                  Nenhuma carga.
                </td>
              </tr>
            ) : (
              colheitasFiltradas.map((r) => {
                const p = r.plantio_id
                  ? plantios.find((x) => String(x.id) === String(r.plantio_id))
                  : null;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.data || "—"}</td>
                    <td className="p-2">{r.cultura || "—"}</td>
                    <td className="p-2">{r.talhao || "—"}</td>
                    <td className="p-2 text-right">
                      {r.area_total_ha
                        ? Number(r.area_total_ha).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="p-2 text-right">
                      {Number(r.bruto_kg || 0).toLocaleString(undefined)}
                    </td>
                    <td className="p-2 text-right">
                      {Number(r.tara_kg || 0).toLocaleString(undefined)}
                    </td>
                    <td className="p-2 text-right">
                      {(Number(r.bruto_kg || 0) - Number(r.tara_kg || 0)).toLocaleString(undefined)}
                    </td>
                    <td className="p-2">
                      {p ? `${p.data_plantio} • ${p.cultura || "—"} • ${p.talhao || "—"}` : "—"}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => excluirCarga(r)}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
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
