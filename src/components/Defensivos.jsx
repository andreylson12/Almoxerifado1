import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Upload, Loader2 } from "lucide-react";

/** NCM -> Tipo (ajuste/expanda conforme sua necessidade) */
const NCM_TO_TIPO = {
  "38089993": "Acaricida",
  "38089199": "Inseticida",
  "38089329": "Inseticida",
  "29155010": "Adjuvante",
  "31052000": "Fertilizante",
  "34029029": "Adjuvante",
  // fallback: "Outro"
};

function toNumber(s) {
  if (s == null) return 0;
  return parseFloat(String(s).replace(",", ".")) || 0;
}

function mapTipoByNcm(ncm) {
  const k = (ncm || "").replace(/\D/g, "");
  return NCM_TO_TIPO[k] || "Outro";
}

export default function Defensivos() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // sub-abas
  const [subTab, setSubTab] = useState("Entrada"); // "Entrada" | "Saída"

  // ====== XML / Pré-visualização de NF-e ======
  const [preview, setPreview] = useState(null);
  const [busyImport, setBusyImport] = useState(false);

  // ====== Saída rápida ======
  const [saida, setSaida] = useState({
    defensivo_id: "",
    quantidade: "",
    unidade: "",
    aplicacao: "",
    data_aplicacao: "",
    talhao: "",
    area_ha: "",
    maquina: "",
    operador: "",
    observacoes: "",
  });
  const setS = (k, v) => setSaida((s) => ({ ...s, [k]: v }));

  // ====== Lista de saídas (para a tabela abaixo do formulário) ======
  const [saidas, setSaidas] = useState([]);
  const [saidasLoading, setSaidasLoading] = useState(false);

  const fetchSaidas = async () => {
    try {
      setSaidasLoading(true);
      const { data, error } = await supabase
        .from("defensivo_movimentacoes")
        .select(
          `
            id, created_at, data_aplicacao, aplicacao, talhao, area_ha, maquina, operador, observacoes,
            quantidade, unidade,
            defensivos ( nome )
          `
        )
        .eq("tipo", "Saida")
        .order("data_aplicacao", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setSaidas(data || []);
    } catch (err) {
      console.error("Falha ao carregar saídas:", err);
      alert("Falha ao carregar saídas.");
    } finally {
      setSaidasLoading(false);
    }
  };

  // Carrega estoque (view)
  const fetchList = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vw_defensivos_estoque")
        .select("id, nome, ncm, tipo, unidade, localizacao, estoque")
        .order("nome", { ascending: true });

      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      console.error("Falha ao carregar defensivos:", err);
      alert("Falha ao carregar defensivos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  // Quando mudar para a aba "Saída", carrega a tabela de saídas
  useEffect(() => {
    if (subTab === "Saída") fetchSaidas();
  }, [subTab]);

  // ====== Parse do(s) XML ======
  const handlePickXML = async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;

    try {
      setPreview({ loading: true });
      const allItems = [];
      let nf = "";
      let fornecedor = "";

      for (const file of files) {
        const xmlText = await file.text();
        const dom = new DOMParser().parseFromString(xmlText, "text/xml");

        nf ||= (dom.querySelector("ide > nNF")?.textContent || "").trim();
        fornecedor ||= (dom.querySelector("emit > xNome")?.textContent || "").trim();

        dom.querySelectorAll("det").forEach((det) => {
          const prod = det.querySelector("prod");
          if (!prod) return;

          const nome = (prod.querySelector("xProd")?.textContent || "").trim();
          const ncm = (prod.querySelector("NCM")?.textContent || "").trim();
          let unidade = (prod.querySelector("uCom")?.textContent || "").trim().toUpperCase();
          if (unidade === "LT") unidade = "L";

          const quantidade =
            toNumber(prod.querySelector("qCom")?.textContent) ||
            toNumber(prod.querySelector("qTrib")?.textContent);

          const lotes = Array.from(det.querySelectorAll("rastro")).map((r) => ({
            lote: (r.querySelector("nLote")?.textContent || "").trim(),
            qLote: toNumber(r.querySelector("qLote")?.textContent),
            fabricacao: (r.querySelector("dFab")?.textContent || "").trim(),
            validade: (r.querySelector("dVal")?.textContent || "").trim(),
          }));

          allItems.push({
            nome,
            ncm,
            unidade,
            quantidade,
            tipo: mapTipoByNcm(ncm),
            lotes,
          });
        });
      }

      setPreview({ nf, fornecedor, itens: allItems });
    } catch (err) {
      console.error(err);
      alert("Falha ao importar NF.");
      setPreview(null);
    }
  };

  // ====== Lançar entradas da pré-visualização ======
  const lancarEntradas = async () => {
    if (!preview?.itens?.length) return;

    setBusyImport(true);
    try {
      const upserts = preview.itens.map((it) => ({
        nome: it.nome,
        ncm: it.ncm || null,
        tipo: it.tipo || "Outro",
        unidade: it.unidade || null,
      }));

      const { data: upserted, error: upErr } = await supabase
        .from("defensivos")
        .upsert(upserts, { onConflict: "nome" })
        .select("id, nome");

      if (upErr) throw upErr;

      const idByName = new Map(upserted.map((d) => [d.nome, d.id]));

      const movimentos = [];
      for (const it of preview.itens) {
        const defensivo_id = idByName.get(it.nome);
        if (!defensivo_id) continue;

        if (it.lotes?.length) {
          for (const l of it.lotes) {
            movimentos.push({
              tipo: "Entrada",
              defensivo_id,
              quantidade: l.qLote || it.quantidade || 0,
              unidade: it.unidade,
              origem: "NF-e",
              nf_numero: preview.nf || null,
              fornecedor: preview.fornecedor || null,
              lote: l.lote || null,
              validade: l.validade || null,
              fabricacao: l.fabricacao || null,
            });
          }
        } else {
          movimentos.push({
            tipo: "Entrada",
            defensivo_id,
            quantidade: it.quantidade || 0,
            unidade: it.unidade,
            origem: "NF-e",
            nf_numero: preview.nf || null,
            fornecedor: preview.fornecedor || null,
            lote: null,
            validade: null,
            fabricacao: null,
          });
        }
      }

      if (movimentos.length) {
        const { error: movErr } = await supabase
          .from("defensivo_movimentacoes")
          .insert(movimentos);
        if (movErr) throw movErr;
      }

      // Recalcula estoque (ignora erro se não existir)
      try { await supabase.rpc("recalcular_estoque_defensivos"); } catch {}

      setPreview(null);
      fetchList();
      alert("Entradas lançadas com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Falha ao lançar entradas.");
    } finally {
      setBusyImport(false);
    }
  };

  // ====== Saída (abate + grava p/ relatório) ======
  const registrarSaida = async () => {
    try {
      const defensivo_id = Number(saida.defensivo_id);
      const quantidade = Number(saida.quantidade);

      if (!defensivo_id) return alert("Selecione o defensivo.");
      if (!quantidade || quantidade <= 0) return alert("Informe uma quantidade válida.");

      const row = rows.find((r) => r.id === defensivo_id);
      if (row && Number(row.estoque || 0) < quantidade) {
        return alert("Estoque insuficiente para essa saída.");
      }

      const payload = {
        tipo: "Saida",
        defensivo_id,
        quantidade,
        unidade: saida.unidade || row?.unidade || null,
        origem: "Aplicação",
        aplicacao: saida.aplicacao || null,
        data_aplicacao: saida.data_aplicacao || null,
        talhao: saida.talhao || null,
        area_ha: saida.area_ha ? Number(saida.area_ha) : null,
        maquina: saida.maquina || null,
        operador: saida.operador || null,
        observacoes: saida.observacoes || null,
      };

      const { error } = await supabase
        .from("defensivo_movimentacoes")
        .insert([payload]);
      if (error) throw error;

      try { await supabase.rpc("recalcular_estoque_defensivos"); } catch {}
      await fetchList();      // atualiza estoque
      await fetchSaidas();    // atualiza a tabela de saídas

      // limpa os campos
      setSaida({
        defensivo_id: "",
        quantidade: "",
        unidade: "",
        aplicacao: "",
        data_aplicacao: "",
        talhao: "",
        area_ha: "",
        maquina: "",
        operador: "",
        observacoes: "",
      });

      alert("Saída registrada com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Falha ao registrar saída.");
    }
  };

  // ====== Filtro local da lista (estoque) ======
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        String(r.nome || "").toLowerCase().includes(term) ||
        String(r.ncm || "").toLowerCase().includes(term)
    );
  }, [q, rows]);

  return (
    <div className="space-y-4">
      {/* Sub-abas */}
      <div className="flex gap-2">
        {["Entrada", "Saída"].map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-3 py-1 rounded border ${
              subTab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ======= Aba ENTRADA ======= */}
      {subTab === "Entrada" && (
        <div className="bg-white p-4 rounded-lg shadow flex flex-col gap-3">
          <label className="font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar NF-e (XML)
          </label>
          <input
            type="file"
            accept=".xml"
            multiple
            onChange={handlePickXML}
            className="border rounded px-3 py-2"
          />

          {preview?.itens?.length ? (
            <div className="mt-3 border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 flex items-center justify-between text-sm">
                <div>
                  <span className="mr-4">NF: <b>{preview.nf || "—"}</b></span>
                  <span>Fornecedor: <b>{preview.fornecedor || "—"}</b></span>
                </div>
                <button
                  disabled={busyImport}
                  onClick={lancarEntradas}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-60"
                >
                  {busyImport ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Lançando…
                    </span>
                  ) : (
                    "Lançar Entradas"
                  )}
                </button>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">NCM</th>
                    <th className="p-2 text-left">Unid.</th>
                    <th className="p-2 text-left">Quantidade</th>
                    <th className="p-2 text-left">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.itens.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{it.nome}</td>
                      <td className="p-2">{it.ncm || "—"}</td>
                      <td className="p-2">{it.unidade || "—"}</td>
                      <td className="p-2">{it.quantidade}</td>
                      <td className="p-2">
                        <select
                          className="border rounded px-2 py-1"
                          value={it.tipo}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPreview((s) => {
                              const clone = { ...s };
                              clone.itens = s.itens.map((x, i) =>
                                i === idx ? { ...x, tipo: v } : x
                              );
                              return clone;
                            });
                          }}
                        >
                          {[
                            "Herbicida",
                            "Fungicida",
                            "Inseticida",
                            "Acaricida",
                            "Nematicida",
                            "Adjuvante",
                            "Fertilizante",
                            "Outro",
                          ].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      {/* ======= Aba SAÍDA ======= */}
      {subTab === "Saída" && (
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <h3 className="font-semibold">Saída rápida (abate estoque + registra)</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              className="border rounded px-3 py-2"
              value={saida.defensivo_id}
              onChange={(e) => {
                const id = e.target.value;
                setS("defensivo_id", id);
                const r = rows.find((x) => x.id === Number(id));
                if (r && !saida.unidade) setS("unidade", r.unidade || "");
              }}
            >
              <option value="">Selecione o defensivo...</option>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>

            <input
              className="border rounded px-3 py-2"
              placeholder="Quantidade"
              type="number"
              value={saida.quantidade}
              onChange={(e) => setS("quantidade", e.target.value)}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Unidade (ex: L, KG)"
              value={saida.unidade}
              onChange={(e) => setS("unidade", e.target.value.toUpperCase())}
            />

            <input
              className="border rounded px-3 py-2"
              type="date"
              value={saida.data_aplicacao}
              onChange={(e) => setS("data_aplicacao", e.target.value)}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Talhão/Área"
              value={saida.talhao}
              onChange={(e) => setS("talhao", e.target.value)}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Área (ha)"
              type="number"
              value={saida.area_ha}
              onChange={(e) => setS("area_ha", e.target.value)}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Máquina"
              value={saida.maquina}
              onChange={(e) => setS("maquina", e.target.value)}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Operador/Funcionário"
              value={saida.operador}
              onChange={(e) => setS("operador", e.target.value)}
            />

            <select
              className="border rounded px-3 py-2"
              value={saida.aplicacao}
              onChange={(e) => setS("aplicacao", e.target.value)}
            >
              <option value="">Aplicação</option>
              <option value="Terrestre">Terrestre</option>
              <option value="Aérea">Aérea</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <textarea
            className="border rounded px-3 py-2 w-full"
            rows={3}
            placeholder="Observações"
            value={saida.observacoes}
            onChange={(e) => setS("observacoes", e.target.value)}
          />

          <div className="flex justify-end">
            <button
              onClick={registrarSaida}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Registrar Saída
            </button>
          </div>

          {/* === Tabela de saídas registradas === */}
          <div className="overflow-x-auto rounded-lg shadow">
            <table className="w-full bg-white text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Defensivo</th>
                  <th className="p-2 text-right">Qtd.</th>
                  <th className="p-2 text-left">Unid.</th>
                  <th className="p-2 text-left">Talhão/Área</th>
                  <th className="p-2 text-left">Máquina</th>
                  <th className="p-2 text-left">Operador</th>
                  <th className="p-2 text-left">Aplicação</th>
                </tr>
              </thead>
              <tbody>
                {saidasLoading ? (
                  <tr>
                    <td className="p-4 text-center" colSpan={8}>
                      <span className="inline-flex items-center gap-2 text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando saídas…
                      </span>
                    </td>
                  </tr>
                ) : saidas.length === 0 ? (
                  <tr>
                    <td className="p-4 text-center text-slate-500" colSpan={8}>
                      Nenhuma saída registrada.
                    </td>
                  </tr>
                ) : (
                  saidas.map((m) => {
                    const dataRef = m.data_aplicacao || m.created_at;
                    const dataFmt = dataRef
                      ? new Date(dataRef).toLocaleDateString()
                      : "—";
                    return (
                      <tr key={m.id} className="border-t">
                        <td className="p-2">{dataFmt}</td>
                        <td className="p-2">{m.defensivos?.nome || "—"}</td>
                        <td className="p-2 text-right">{Number(m.quantidade || 0)}</td>
                        <td className="p-2">{m.unidade || "—"}</td>
                        <td className="p-2">
                          {m.talhao || "—"}
                          {m.area_ha ? ` (${m.area_ha} ha)` : ""}
                        </td>
                        <td className="p-2">{m.maquina || "—"}</td>
                        <td className="p-2">{m.operador || "—"}</td>
                        <td className="p-2">{m.aplicacao || "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Busca no estoque / lista de defensivos */}
      <input
        className="border rounded px-3 py-2 w-full"
        placeholder="Pesquisar por nome ou NCM..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Nome</th>
              <th className="p-2 text-left">NCM</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Unidade</th>
              <th className="p-2 text-center">Qtd.</th>
              <th className="p-2 text-left">Localização</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-center" colSpan={6}>
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando…
                  </span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={6}>
                  Nenhum registro.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.nome}</td>
                  <td className="p-2">{r.ncm || "—"}</td>
                  <td className="p-2">{r.tipo || "—"}</td>
                  <td className="p-2">{r.unidade || "—"}</td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        (Number(r.estoque) || 0) > 50
                          ? "bg-green-100 text-green-700"
                          : (Number(r.estoque) || 0) > 10
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {Number(r.estoque || 0)}
                    </span>
                  </td>
                  <td className="p-2">{r.localizacao || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
