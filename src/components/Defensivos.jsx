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
  const [rows, setRows] = useState([]);              // defensivos + estoque (para selects)
  const [q, setQ] = useState("");                    // busca (aba Entrada)
  const [loading, setLoading] = useState(false);

  const [subTab, setSubTab] = useState("Entrada");   // "Entrada" | "Saída" | "Inventário"

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

  // ====== Lista de SAÍDAS ======
  const [saidas, setSaidas] = useState([]);
  const [loadingSaidas, setLoadingSaidas] = useState(false);

  // ====== Inventário (contagem/ajuste) ======
  const [inv, setInv] = useState({
    defensivo_id: "",
    contagem: "",
    unidade: "",
    observacoes: "",
  });
  const setInvField = (k, v) => setInv((s) => ({ ...s, [k]: v }));

  const [ajustes, setAjustes] = useState([]);        // histórico de ajustes
  const [loadingAjustes, setLoadingAjustes] = useState(false);

  // ====== Relatório (Entradas -> PDF, sem libs externas) ======
  const [repIni, setRepIni] = useState("");          // yyyy-mm-dd
  const [repFim, setRepFim] = useState("");          // yyyy-mm-dd
  const [repBusy, setRepBusy] = useState(false);

  // -------- Carrega lista de defensivos (view de estoque) --------
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

  // -------- Carrega lista de SAÍDAS --------
  const fetchSaidas = async () => {
    setLoadingSaidas(true);
    try {
      const rel = "defensivo_movimentacoes_defensivo_id_fkey";
      const { data, error } = await supabase
        .from("defensivo_movimentacoes")
        .select(
          `
          id, created_at, data_aplicacao, aplicacao, talhao, area_ha, maquina, operador, observacoes,
          quantidade, unidade,
          defensivo:defensivos!${rel} ( id, nome )
        `
        )
        .eq("tipo", "Saida")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setSaidas(data || []);
    } catch (err) {
      console.error("Falha ao carregar saídas:", err);
      alert("Falha ao carregar saídas.");
    } finally {
      setLoadingSaidas(false);
    }
  };

  // -------- Carrega histórico de AJUSTES (origem Inventário) --------
  const fetchAjustes = async () => {
    setLoadingAjustes(true);
    try {
      const rel = "defensivo_movimentacoes_defensivo_id_fkey";
      const { data, error } = await supabase
        .from("defensivo_movimentacoes")
        .select(
          `
          id, created_at, tipo, quantidade, unidade, observacoes,
          defensivo:defensivos!${rel} ( id, nome )
        `
        )
        .eq("origem", "Inventário")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setAjustes(data || []);
    } catch (err) {
      console.error("Falha ao carregar ajustes:", err);
      alert("Falha ao carregar ajustes de inventário.");
    } finally {
      setLoadingAjustes(false);
    }
  };

  useEffect(() => { fetchList(); }, []);
  useEffect(() => {
    if (subTab === "Saída") fetchSaidas();
    if (subTab === "Inventário") fetchAjustes();
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

  // ====== Lançar ENTRADAS ======
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

      try { await supabase.rpc("recalcular_estoque_defensivos"); } catch (_) {}

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

  // ====== Registrar SAÍDA ======
  const selectedRow = useMemo(
    () => rows.find((r) => r.id === Number(saida.defensivo_id)),
    [rows, saida.defensivo_id]
  );

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
        unidade: saida.unidade || selectedRow?.unidade || null,
        origem: "Aplicação",
        aplicacao: saida.aplicacao || null,
        data_aplicacao: saida.data_aplicacao || null,
        talhao: saida.talhao || null,
        area_ha: saida.area_ha ? Number(saida.area_ha) : null,
        maquina: saida.maquina || null,
        operador: saida.operador || null,
        observacoes: saida.observacoes || null,
      };

      const { error } = await supabase.from("defensivo_movimentacoes").insert([payload]);
      if (error) throw error;

      try { await supabase.rpc("recalcular_estoque_defensivos"); } catch (_) {}

      await fetchList();
      await fetchSaidas();

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

  // ====== Registrar AJUSTE DE INVENTÁRIO ======
  const registrarInventario = async () => {
    try {
      const defensivo_id = Number(inv.defensivo_id);
      const contagem = Number(inv.contagem);

      if (!defensivo_id) return alert("Selecione o defensivo.");
      if (!Number.isFinite(contagem) || contagem < 0) {
        return alert("Informe uma contagem válida (>= 0).");
      }

      const row = rows.find((r) => r.id === defensivo_id);
      const atual = Number(row?.estoque || 0);
      const diff = contagem - atual;

      if (diff === 0) {
        alert("Sem diferença entre contagem e estoque atual.");
        return;
      }

      const isEntrada = diff > 0;
      const payload = {
        tipo: isEntrada ? "Entrada" : "Saida",
        defensivo_id,
        quantidade: Math.abs(diff),
        unidade: inv.unidade || row?.unidade || null,
        origem: "Inventário",
        observacoes:
          inv.observacoes ||
          `Ajuste de inventário. Contagem=${contagem}, EstoqueAnterior=${atual}`,
      };

      const { error } = await supabase.from("defensivo_movimentacoes").insert([payload]);
      if (error) throw error;

      try { await supabase.rpc("recalcular_estoque_defensivos"); } catch (_) {}

      await fetchList();
      await fetchAjustes();

      setInv({ defensivo_id: "", contagem: "", unidade: "", observacoes: "" });
      alert("Ajuste de inventário registrado.");
    } catch (err) {
      console.error(err);
      alert("Falha ao registrar ajuste de inventário.");
    }
  };

  // ====== Relatório PDF (Entradas) ======
  const gerarPdfEntradas = async () => {
    try {
      setRepBusy(true);
      const rel = "defensivo_movimentacoes_defensivo_id_fkey";

      let query = supabase
        .from("defensivo_movimentacoes")
        .select(
          `
          id, created_at, origem, nf_numero, fornecedor, quantidade, unidade, lote, validade, fabricacao,
          defensivo:defensivos!${rel} ( nome )
        `
        )
        .eq("tipo", "Entrada")
        .order("created_at", { ascending: true })
        .limit(1000);

      // Período (opcional) em created_at
      if (repIni) query = query.gte("created_at", `${repIni}T00:00:00`);
      if (repFim) query = query.lte("created_at", `${repFim}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;

      const entradas = data || [];
      if (!entradas.length) {
        alert("Nenhuma entrada no período selecionado.");
        return;
      }

      // Totais por unidade
      const totalPorUn = entradas.reduce((acc, r) => {
        const u = r.unidade || "";
        acc[u] = (acc[u] || 0) + Number(r.quantidade || 0);
        return acc;
      }, {});

      // HTML do relatório
      const hoje = new Date().toLocaleString();
      const periodo =
        repIni || repFim
          ? `${repIni || "…"} a ${repFim || "…"}`
          : "Todos os registros";

      const linhas = entradas
        .map((r) => {
          const data = new Date(r.created_at).toLocaleString();
          const nf = r.nf_numero || "—";
          const forn = r.fornecedor || "—";
          const prod = r.defensivo?.nome || "—";
          const qtd = `${r.quantidade ?? 0} ${r.unidade || ""}`.trim();
          const lote = r.lote || "—";
          const val = r.validade || "—";
          return `
            <tr>
              <td>${data}</td>
              <td>${nf}</td>
              <td>${forn}</td>
              <td>${prod}</td>
              <td style="text-align:right">${qtd}</td>
              <td>${lote}</td>
              <td>${val}</td>
            </tr>`;
        })
        .join("");

      const totaisHtml = Object.entries(totalPorUn)
        .map(([u, v]) => `<span style="margin-right:16px"><b>Total</b> ${v} ${u}</span>`)
        .join("");

      const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Relatório de Entradas - Defensivos</title>
  <style>
    * { font-family: Arial, Helvetica, sans-serif; }
    h1 { font-size: 18px; margin: 0 0 4px 0; }
    h2 { font-size: 14px; margin: 0 0 16px 0; color: #444; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
    thead th { background: #f3f4f6; text-align: left; }
    .meta { font-size: 12px; color: #555; margin: 8px 0 12px; }
    .totais { margin: 12px 0; font-size: 12px; }
    .footer { margin-top: 24px; font-size: 11px; color: #666; }
    @media print {
      .noprint { display: none; }
      @page { size: A4 portrait; margin: 14mm; }
    }
  </style>
</head>
<body>
  <div class="noprint" style="text-align:right;margin-bottom:8px">
    <button onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>
  <h1>Relatório de Entradas - Defensivos</h1>
  <h2>Período: ${periodo}</h2>
  <div class="meta">Gerado em: ${hoje}</div>

  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>NF</th>
        <th>Fornecedor</th>
        <th>Produto</th>
        <th style="text-align:right">Quantidade</th>
        <th>Lote</th>
        <th>Validade</th>
      </tr>
    </thead>
    <tbody>
      ${linhas}
    </tbody>
  </table>

  <div class="totais">
    ${totaisHtml}
  </div>

  <div class="footer">
    Origem dos dados: defensivo_movimentacoes (tipo = "Entrada").
  </div>
</body>
</html>`;

      const w = window.open("", "_blank");
      if (!w) {
        alert("Bloqueio de pop-up: permita a janela para ver o PDF.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (err) {
      console.error(err);
      alert("Falha ao gerar o relatório.");
    } finally {
      setRepBusy(false);
    }
  };

  // ====== Filtro local da lista (apenas para a aba Entrada) ======
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
        {["Entrada", "Saída", "Inventário"].map((t) => (
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

      {/* Toolbar do relatório (fica naquela faixa ao lado direito) */}
      {subTab === "Entrada" && (
        <div className="flex flex-wrap items-end justify-end gap-2">
          <div className="text-sm text-slate-600 mr-2">Relatório de Entradas:</div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={repIni}
              onChange={(e) => setRepIni(e.target.value)}
              className="border rounded px-2 py-1"
              title="Data inicial (opcional)"
            />
            <span className="text-slate-500">até</span>
            <input
              type="date"
              value={repFim}
              onChange={(e) => setRepFim(e.target.value)}
              className="border rounded px-2 py-1"
              title="Data final (opcional)"
            />
            <button
              onClick={gerarPdfEntradas}
              disabled={repBusy}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded disabled:opacity-60"
              title="Gera o relatório e abre a janela de impressão"
            >
              {repBusy ? "Gerando..." : "Gerar PDF (Entradas)"}
            </button>
          </div>
        </div>
      )}

      {/* ======= Aba ENTRADA ======= */}
      {subTab === "Entrada" && (
        <>
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
                              "Herbicida","Fungicida","Inseticida","Acaricida",
                              "Nematicida","Adjuvante","Fertilizante","Outro",
                            ].map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          {/* Busca + Lista de defensivos */}
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
        </>
      )}

      {/* ======= Aba SAÍDA ======= */}
      {subTab === "Saída" && (
        <>
          <div className="bg-white p-4 rounded-lg shadow space-y-3">
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
          </div>

          {/* Lista de SAÍDAS */}
          <div className="overflow-x-auto rounded-lg shadow">
            <table className="w-full bg-white">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Defensivo</th>
                  <th className="p-2 text-left">Qtd/Unid</th>
                  <th className="p-2 text-left">Aplicação</th>
                  <th className="p-2 text-left">Talhão / Área (ha)</th>
                  <th className="p-2 text-left">Máquina</th>
                  <th className="p-2 text-left">Operador</th>
                  <th className="p-2 text-left">Observações</th>
                </tr>
              </thead>
              <tbody>
                {loadingSaidas ? (
                  <tr>
                    <td className="p-4 text-center" colSpan={8}>
                      <span className="inline-flex items-center gap-2 text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando saídas…
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
                  saidas.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="p-2">
                        {m.data_aplicacao
                          ? new Date(m.data_aplicacao).toLocaleDateString()
                          : new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-2">{m.defensivo?.nome || "—"}</td>
                      <td className="p-2">
                        {m.quantidade} {m.unidade || ""}
                      </td>
                      <td className="p-2">{m.aplicacao || "—"}</td>
                      <td className="p-2">
                        {m.talhao || "—"} {m.area_ha ? ` / ${m.area_ha}` : ""}
                      </td>
                      <td className="p-2">{m.maquina || "—"}</td>
                      <td className="p-2">{m.operador || "—"}</td>
                      <td className="p-2">{m.observacoes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ======= Aba INVENTÁRIO ======= */}
      {subTab === "Inventário" && (
        <>
          <div className="bg-white p-4 rounded-lg shadow space-y-3">
            <h3 className="font-semibold">Ajuste de inventário (contagem)</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="border rounded px-3 py-2"
                value={inv.defensivo_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setInvField("defensivo_id", id);
                  const r = rows.find((x) => x.id === Number(id));
                  if (r && !inv.unidade) setInvField("unidade", r.unidade || "");
                }}
              >
                <option value="">Selecione o defensivo...</option>
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>

              <input
                className="border rounded px-3 py-2"
                placeholder="Contagem (quantidade total)"
                type="number"
                value={inv.contagem}
                onChange={(e) => setInvField("contagem", e.target.value)}
              />

              <input
                className="border rounded px-3 py-2"
                placeholder="Unidade (ex: L, KG)"
                value={inv.unidade}
                onChange={(e) => setInvField("unidade", e.target.value.toUpperCase())}
              />
            </div>

            {inv.defensivo_id ? (
              <div className="text-sm text-slate-600">
                Estoque atual:{" "}
                <b>
                  {Number(rows.find((r) => r.id === Number(inv.defensivo_id))?.estoque || 0)}{" "}
                  {rows.find((r) => r.id === Number(inv.defensivo_id))?.unidade || ""}
                </b>
              </div>
            ) : null}

            <textarea
              className="border rounded px-3 py-2 w-full"
              rows={3}
              placeholder="Observações (opcional)"
              value={inv.observacoes}
              onChange={(e) => setInvField("observacoes", e.target.value)}
            />

            <div className="flex justify-end">
              <button
                onClick={registrarInventario}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Registrar Ajuste
              </button>
            </div>
          </div>

          {/* Histórico de AJUSTES */}
          <div className="overflow-x-auto rounded-lg shadow">
            <table className="w-full bg-white">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Defensivo</th>
                  <th className="p-2 text-left">Ajuste</th>
                  <th className="p-2 text-left">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {loadingAjustes ? (
                  <tr>
                    <td className="p-4 text-center" colSpan={4}>
                      <span className="inline-flex items-center gap-2 text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando ajustes…
                      </span>
                    </td>
                  </tr>
                ) : ajustes.length === 0 ? (
                  <tr>
                    <td className="p-4 text-center text-slate-500" colSpan={4}>
                      Nenhum ajuste registrado.
                    </td>
                  </tr>
                ) : (
                  ajustes.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="p-2">{new Date(m.created_at).toLocaleString()}</td>
                      <td className="p-2">{m.defensivo?.nome || "—"}</td>
                      <td className={`p-2 ${m.tipo === "Entrada" ? "text-green-700" : "text-red-700"}`}>
                        {m.tipo === "Entrada" ? "+" : "-"} {m.quantidade} {m.unidade || ""}
                      </td>
                      <td className="p-2">{m.observacoes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
