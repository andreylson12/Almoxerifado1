// src/components/Plantios.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import TalhoesManager from "./TalhoesManager";

/* ===== Helpers de sementes ===== */
function calcSeedsPerKg(pms_g) {
  const pms = Number(pms_g || 0);
  if (!pms || pms <= 0) return 0;
  return 1_000_000 / pms;
}
function calcNecessidades({
  areaHa = 0,
  populacaoHa = 0,
  germ_pct = 90,
  pureza_pct = 98,
  perdas_pct = 5,
  tipo_embalagem = "saco",
  kg_por_embalagem = 20,
  sementes_por_saco,
  pms_g,
}) {
  const area = Number(areaHa || 0);
  const pop = Number(populacaoHa || 0);
  const g = Math.max(0.5, Number(germ_pct || 0) / 100);
  const p = Math.max(0.5, Number(pureza_pct || 0) / 100);
  const perdas = Math.min(0.3, Math.max(0, Number(perdas_pct || 0) / 100));
  const ajuste = 1 / (g * p * (1 - perdas));
  const sementesNec = area * pop * ajuste;

  const kgEmb = Number(kg_por_embalagem || 0) > 0 ? Number(kg_por_embalagem) : 0;

  let sementesPorEmb = 0;
  let sementesPorKg = 0;

  if (Number(sementes_por_saco || 0) > 0) {
    sementesPorEmb = Number(sementes_por_saco);
    sementesPorKg = kgEmb ? sementesPorEmb / kgEmb : 0;
  } else if (Number(pms_g || 0) > 0) {
    sementesPorKg = calcSeedsPerKg(pms_g);
    sementesPorEmb = kgEmb * sementesPorKg;
  }

  const kgNec = sementesPorKg > 0 ? sementesNec / sementesPorKg : 0;
  const embalagensNec = kgEmb > 0 ? kgNec / kgEmb : 0;

  return { sementesNec, kgNec, embalagensNec, sementesPorKg, sementesPorEmb, tipo_embalagem };
}

export default function Plantios() {
  /* ===== Estados de filtros/header ===== */
  const [fSafra, setFSafra] = useState("");
  const [fCultura, setFCultura] = useState("");

  /* ===== Fazendas & Talhões (filtrados pela fazenda) ===== */
  const [fazendas, setFazendas] = useState([]);
  const [fazenda, setFazenda] = useState(""); // id da fazenda selecionada
  const [talhoes, setTalhoes] = useState([]);

  const [showTalhoes, setShowTalhoes] = useState(false);

  /* ===== Dados de plantios ===== */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ===== Form novo plantio ===== */
  const [form, setForm] = useState({
    data_plantio: new Date().toISOString().slice(0, 10),
    cultura: "",
    safra: "",
    talhao: "", // nome do talhão
    area_ha: "",
    espacamento: "",
    populacao_ha: "",
    obs: "",
    tipo_embalagem: "saco",
    kg_por_embalagem: 20,
    sementes_por_saco: "",
    pms_g: "",
    germinacao_pct: 90,
    pureza_pct: 98,
    perdas_pct: 5,
  });
  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  /* ===== Carregadores ===== */
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

  const fetchTalhoes = async (fazendaId) => {
    try {
      if (!fazendaId) {
        setTalhoes([]);
        return;
      }
      const { data, error } = await supabase
        .from("talhoes")
        .select("*")
        .eq("fazenda_id", fazendaId) // <- FILTRA PELO ID DA FAZENDA
        .order("nome", { ascending: true });
      if (error) throw error;
      setTalhoes(data || []);
    } catch (e) {
      console.error(e);
      alert("Falha ao carregar talhões.");
    }
  };

  const fetchPlantios = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("plantios")
        .select("*")
        .order("data_plantio", { ascending: false })
        .order("id", { ascending: false });

      if (fSafra) q = q.ilike("safra", `%${fSafra}%`);
      if (fCultura) q = q.ilike("cultura", `%${fCultura}%`);

      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      console.error(err);
      alert("Falha ao carregar plantios.");
    } finally {
      setLoading(false);
    }
  };

  /* ===== Efeitos ===== */
  useEffect(() => {
    fetchFazendas();
    fetchPlantios();
  }, []);

  useEffect(() => {
    fetchTalhoes(fazenda);
    // zera seleção de talhão e área quando troca de fazenda
    setF("talhao", "");
    setF("area_ha", "");
  }, [fazenda]);

  /* Preenche área quando escolhe talhão */
  useEffect(() => {
    const t = talhoes.find((x) => x.nome === form.talhao);
    if (t) setF("area_ha", t.area_ha ?? "");
  }, [form.talhao, talhoes]);

  /* ===== Inserção / remoção ===== */
  const addPlantio = async () => {
    try {
      const payload = {
        data_plantio: form.data_plantio || null,
        cultura: form.cultura || null,
        safra: form.safra || null,
        talhao: form.talhao || null, // salva o NOME do talhão (relacionado indiretamente pela fazenda escolhida)
        area_ha: form.area_ha ? Number(form.area_ha) : null,
        espacamento: form.espacamento ? Number(form.espacamento) : null,
        populacao_ha: form.populacao_ha ? Number(form.populacao_ha) : null,
        obs: form.obs || null,
        tipo_embalagem: form.tipo_embalagem || null,
        kg_por_embalagem: form.kg_por_embalagem ? Number(form.kg_por_embalagem) : null,
        sementes_por_saco: form.sementes_por_saco ? Number(form.sementes_por_saco) : null,
        pms_g: form.pms_g ? Number(form.pms_g) : null,
        germinacao_pct: form.germinacao_pct ? Number(form.germinacao_pct) : null,
        pureza_pct: form.pureza_pct ? Number(form.pureza_pct) : null,
        perdas_pct: form.perdas_pct ? Number(form.perdas_pct) : null,
      };

      if (!fazenda) return alert("Selecione a fazenda.");
      if (!payload.cultura) return alert("Informe a cultura.");
      if (!payload.talhao) return alert("Selecione um talhão.");
      if (!payload.area_ha) return alert("Informe a área (ha).");
      if (!payload.populacao_ha) return alert("Informe a população (sementes/ha).");

      const { error } = await supabase.from("plantios").insert([payload]);
      if (error) throw error;

      setForm((s) => ({ ...s, obs: "" }));
      fetchPlantios();
    } catch (err) {
      console.error(err);
      alert("Falha ao salvar plantio.");
    }
  };

  const removePlantio = async (row) => {
    if (!confirm("Deseja excluir este plantio?")) return;
    try {
      const { error } = await supabase.from("plantios").delete().eq("id", row.id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      console.error(e);
      alert("Falha ao excluir plantio.");
    }
  };

  /* ===== Filtrados / Totais ===== */
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fSafra && !(r.safra || "").toLowerCase().includes(fSafra.toLowerCase())) return false;
      if (fCultura && !(r.cultura || "").toLowerCase().includes(fCultura.toLowerCase())) return false;
      return true;
    });
  }, [rows, fSafra, fCultura]);

  const totalArea = filtered.reduce((s, r) => s + Number(r.area_ha || 0), 0);

  /* ===== UI ===== */
  return (
    <div className="space-y-5">
      {/* Filtros & Header */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {/* Fazenda */}
          <div className="col-span-2">
            <label className="text-xs text-slate-500">Fazenda</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={fazenda}
              onChange={(e) => setFazenda(e.target.value)}
            >
              <option value="">Selecione a fazenda…</option>
              {fazendas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">Safra</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="ex: 2024/25"
              value={fSafra}
              onChange={(e) => setFSafra(e.target.value)}
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

          <div className="flex items-end">
            <button
              onClick={fetchPlantios}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
            >
              Atualizar
            </button>
          </div>

          <div className="p-2 bg-slate-50 rounded flex items-center justify-between">
            <div>
              <div className="text-slate-600 text-xs">Registros</div>
              <div className="font-semibold leading-5">{filtered.length}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-600 text-xs">Área total (ha)</div>
              <div className="font-semibold">
                {totalArea.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gerenciar Talhões */}
      <div className="bg-white rounded-lg shadow">
        <button
          className="w-full flex items-center justify-between px-4 py-3"
          onClick={() => setShowTalhoes((s) => !s)}
        >
          <span className="font-semibold">Gerenciar Talhões</span>
          {showTalhoes ? <ChevronUp /> : <ChevronDown />}
        </button>
        {showTalhoes && (
          <div className="p-4 border-t">
            {/* Ao salvar/excluir talhões, recarrega talhões da fazenda atual */}
            <TalhoesManager onChanged={() => fetchTalhoes(fazenda)} />
          </div>
        )}
      </div>

      {/* Formulário de Plantio */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <h3 className="font-semibold text-lg">Novo plantio</h3>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-slate-500">Data</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={form.data_plantio}
              onChange={(e) => setF("data_plantio", e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Cultura</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="ex: Soja"
              value={form.cultura}
              onChange={(e) => setF("cultura", e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Safra</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="ex: 2024/25"
              value={form.safra}
              onChange={(e) => setF("safra", e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Talhão</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.talhao}
              onChange={(e) => setF("talhao", e.target.value)}
              disabled={!fazenda}
              title={!fazenda ? "Selecione a fazenda primeiro" : ""}
            >
              <option value="">{fazenda ? "Selecione o talhão…" : "Selecione a fazenda…"}</option>
              {talhoes.map((t) => (
                <option key={t.id} value={t.nome}>
                  {t.nome} {t.area_ha ? `• ${t.area_ha} ha` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">Área (ha)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              type="number"
              placeholder="Área (ha)"
              value={form.area_ha}
              onChange={(e) => setF("area_ha", e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Observações</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="Observações"
              value={form.obs}
              onChange={(e) => setF("obs", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500">Espaçamento</label>
            <input
              className="border rounded px-3 py-2 w-full"
              type="number"
              placeholder="Espaçamento"
              value={form.espacamento}
              onChange={(e) => setF("espacamento", e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">População (sementes/ha)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              type="number"
              placeholder="ex: 300000"
              value={form.populacao_ha}
              onChange={(e) => setF("populacao_ha", e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Tipo de embalagem</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.tipo_embalagem}
              onChange={(e) => setF("tipo_embalagem", e.target.value)}
            >
              <option value="saco">Saco</option>
              <option value="bigbag">Big bag</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-slate-500">Peso da embalagem (kg)</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={form.kg_por_embalagem}
              onChange={(e) => setF("kg_por_embalagem", e.target.value)}
              placeholder="20 | 25 | 600 | 1000"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Sementes por embalagem (se tiver)</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={form.sementes_por_saco}
              onChange={(e) => setF("sementes_por_saco", e.target.value)}
              placeholder="ex: 60000"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">PMS (g / mil)</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={form.pms_g}
              onChange={(e) => setF("pms_g", e.target.value)}
              placeholder="ex: 180"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Germinação / Pureza / Perdas (%)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                className="border rounded px-2 py-2 w-full"
                value={form.germinacao_pct}
                onChange={(e) => setF("germinacao_pct", e.target.value)}
                placeholder="90"
              />
              <input
                type="number"
                className="border rounded px-2 py-2 w-full"
                value={form.pureza_pct}
                onChange={(e) => setF("pureza_pct", e.target.value)}
                placeholder="98"
              />
              <input
                type="number"
                className="border rounded px-2 py-2 w-full"
                value={form.perdas_pct}
                onChange={(e) => setF("perdas_pct", e.target.value)}
                placeholder="5"
              />
            </div>
          </div>

          <div className="hidden md:block" />
        </div>

        {/* Resumo em tempo real */}
        {(() => {
          const r = calcNecessidades({
            areaHa: form.area_ha,
            populacaoHa: form.populacao_ha,
            germ_pct: form.germinacao_pct,
            pureza_pct: form.pureza_pct,
            perdas_pct: form.perdas_pct,
            tipo_embalagem: form.tipo_embalagem,
            kg_por_embalagem: form.kg_por_embalagem,
            sementes_por_saco: form.sementes_por_saco,
            pms_g: form.pms_g,
          });

          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 bg-slate-50 rounded">
                <div className="text-slate-500">Sementes necessárias</div>
                <div className="text-lg font-semibold">
                  {Math.round(r.sementesNec || 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded">
                <div className="text-slate-500">Kg necessários</div>
                <div className="text-lg font-semibold">
                  {r.kgNec ? r.kgNec.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded">
                <div className="text-slate-500">
                  {r.tipo_embalagem === "bigbag" ? "Big bags (estimado)" : "Sacos (estimado)"}
                </div>
                <div className="text-lg font-semibold">
                  {r.embalagensNec ? r.embalagensNec.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded">
                <div className="text-slate-500">Sementes / embalagem</div>
                <div className="text-lg font-semibold">
                  {r.sementesPorEmb ? Math.round(r.sementesPorEmb).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex justify-end">
          <button
            onClick={addPlantio}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
          >
            Salvar plantio
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-left">Safra</th>
              <th className="p-2 text-left">Cultura</th>
              <th className="p-2 text-left">Talhão</th>
              <th className="p-2 text-right">Área (ha)</th>
              <th className="p-2 text-right">População</th>
              <th className="p-2 text-left">Embalagem</th>
              <th className="p-2 text-left">Qualidade</th>
              <th className="p-2 text-left">Resumo</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-center" colSpan={10}>
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                  </span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={10}>
                  Nenhum plantio.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const resumo = calcNecessidades({
                  areaHa: r.area_ha,
                  populacaoHa: r.populacao_ha,
                  germ_pct: r.germinacao_pct,
                  pureza_pct: r.pureza_pct,
                  perdas_pct: r.perdas_pct,
                  tipo_embalagem: r.tipo_embalagem,
                  kg_por_embalagem: r.kg_por_embalagem,
                  sementes_por_saco: r.sementes_por_saco,
                  pms_g: r.pms_g,
                });
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.data_plantio || "—"}</td>
                    <td className="p-2">{r.safra || "—"}</td>
                    <td className="p-2">{r.cultura || "—"}</td>
                    <td className="p-2">{r.talhao || "—"}</td>
                    <td className="p-2 text-right">
                      {Number(r.area_ha || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right">{Number(r.populacao_ha || 0).toLocaleString()}</td>
                    <td className="p-2">
                      {r.tipo_embalagem || "—"}{" "}
                      {r.kg_por_embalagem ? `• ${r.kg_por_embalagem} kg` : ""}
                      {r.sementes_por_saco ? ` • ${Number(r.sementes_por_saco).toLocaleString()} sementes` : ""}
                      {r.pms_g ? ` • PMS ${r.pms_g} g` : ""}
                    </td>
                    <td className="p-2">
                      {r.germinacao_pct || "—"}% / {r.pureza_pct || "—"}% / {r.perdas_pct || "—"}%
                    </td>
                    <td className="p-2 text-sm">
                      {resumo.kgNec
                        ? `${resumo.kgNec.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg • ${
                            resumo.tipo_embalagem === "bigbag" ? "big bags" : "sacos"
                          }: ${resumo.embalagensNec.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => removePlantio(r)}
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
