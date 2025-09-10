// src/components/Defensivos.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Upload, Loader2 } from "lucide-react";

/** NCM -> Tipo (pode expandir quando quiser) */
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
  // sub-abas internas
  const [tab, setTab] = useState("Estoque"); // Estoque | Entrada | Saida

  // ======== LISTA / ESTOQUE ========
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        String(r.nome || "").toLowerCase().includes(term) ||
        String(r.ncm || "").toLowerCase().includes(term)
    );
  }, [q, rows]);

  // ======== ENTRADA (XML) ========
  const [preview, setPreview] = useState(null);
  const [busyImport, setBusyImport] = useState(false);

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

          const quantidade = toNumber(
            prod.querySelector("qCom")?.textContent ??
            prod.querySelector("qTrib")?.textContent
          );

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

  const lancarEntradas = async () => {
    if (!preview?.itens?.length) return;

    setBusyImport(true);
    try {
      // 1) UPSERT defensivos (por nome)
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

      // 2) Movimentações de entrada
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
          });
        }
      }

      if (movimentos.length) {
        const { error: movErr } = await supabase
          .from("defensivo_movimentacoes")
          .insert(movimentos);
        if (movErr) throw movErr;
      }

      // 3) (opcional) função para sincronismo — ignore se não existir
      await supabase.rpc("recalcular_estoque_defensivos").catch(() => {});

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

  // ======== SAÍDA ========
  const [saida, setSaida] = useState({
    defensivo_id: "",
    quantidade: "",
    unidade: "",
    destino: "",
    aplicacao_data: "",
    talhao: "",
    area_ha: "",
    maquina: "",
    operador: "",
    observacao: "",
  });

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === Number(saida.defensivo_id)),
    [rows, saída?.defensivo_id] // eslint-disable-line
  );

  const handleSelectDef = (idStr) => {
    const id = Number(idStr || 0);
    const r = rows.find((x) => x.id === id);
    setSaida((s) => ({
      ...s,
      defensivo_id: idStr,
      unidade: r?.unidade || s.unidade,
    }));
  };

  const registrarSaida = async () => {
    const id = Number(saida.defensivo_id || 0);
    const qtd = Number(saida.quantidade || 0);

    if (!id) return alert("Selecione o defensivo.");
    if (!qtd || qtd <= 0) return alert("Informe uma quantidade válida.");

    const disponivel = Number(selectedRow?.estoque || 0);
    if (qtd > disponivel) {
      return alert(`Estoque insuficiente. Disponível: ${disponivel}.`);
    }

    try {
      const payload = {
        tipo: "Saida",
        defensivo_id: id,
        quantidade: qtd,
        unidade: saida.unidade || null,
        origem: "Aplicação", // origem lógica dessas saídas
        destino: saida.destino || null,
        aplicacao_data: saida.aplicacao_data || null,
        talhao: saida.talhao || null,
        area_ha: saida.area_ha ? Number(saida.area_ha) : null,
        maquina: saida.maquina || null,
        operador: saida.operador || null,
        observacao: saida.observacao || null,
      };

      const { error } = await supabase
        .from("defensivo_movimentacoes")
        .insert([payload]);
      if (error) throw error;

      // estoque reflete pela view; apenas recarregar
      fetchList();
      setSaida({
        defensivo_id: "",
        quantidade: "",
        unidade: "",
        destino: "",
        aplicacao_data: "",
        talhao: "",
        area_ha: "",
        maquina: "",
        operador: "",
        observacao: "",
      });
      alert("Saída registrada.");
    } catch (e) {
      console.error(e);
      alert("Falha ao registrar saída.");
    }
  };

  return (
    <div className="space-y-4">
      {/* SUB-ABAS */}
      <div className="flex gap-2">
        {["Estoque", "Entrada (XML)", "Saída"].map((t) => (
          <button
            key={t}
            className={`px-3 py-1 rounded border ${
              tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ======== ABA ESTOQUE ======== */}
      {tab === "Estoque" && (
        <>
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

      {/* ======== ABA ENTRADA (XML) ======== */}
      {tab === "Entrada (XML)" && (
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
                            <option key={t} value={t}>
                              {t}
                            </option>
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

      {/* ======== ABA SAÍDA ======== */}
      {tab === "Saída" && (
        <div className="bg-white p-4 rounded-lg shadow space-y-3">
          <h3 className="font-semibold">Saída rápida (abate estoque + registra relatório)</h3>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              className="border rounded px-3 py-2 md:col-span-2"
              value={saida.defensivo_id}
              onChange={(e) => handleSelectDef(e.target.value)}
            >
              <option value="">Selecione o defensivo…</option>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome} {r.unidade ? `(${r.unidade})` : ""} • Estoque: {Number(r.estoque || 0)}
                </option>
              ))}
            </select>

            <input
              className="border rounded px-3 py-2"
              placeholder="Quantidade"
              value={saida.quantidade}
              onChange={(e) => setSaida((s) => ({ ...s, quantidade: e.target.value }))}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Unidade"
              value={saida.unidade}
              onChange={(e) => setSaida((s) => ({ ...s, unidade: e.target.value }))}
            />

            <select
              className="border rounded px-3 py-2"
              value={saida.destino}
              onChange={(e) => setSaida((s) => ({ ...s, destino: e.target.value }))}
            >
              <option value="">Aplicação</option>
              <option value="Pulverização">Pulverização</option>
              <option value="Tratamento de sementes">Tratamento de sementes</option>
              <option value="Outro">Outro</option>
            </select>

            <input
              type="date"
              className="border rounded px-3 py-2"
              value={saida.aplicacao_data}
              onChange={(e) => setSaida((s) => ({ ...s, aplicacao_data: e.target.value }))}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Talhão/Área"
              value={saida.talhao}
              onChange={(e) => setSaida((s) => ({ ...s, talhao: e.target.value }))}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Área (ha)"
              value={saida.area_ha}
              onChange={(e) => setSaida((s) => ({ ...s, area_ha: e.target.value }))}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Máquina"
              value={saida.maquina}
              onChange={(e) => setSaida((s) => ({ ...s, maquina: e.target.value }))}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Operador/Funcionário"
              value={saida.operador}
              onChange={(e) => setSaida((s) => ({ ...s, operador: e.target.value }))}
            />
          </div>

          <textarea
            className="border rounded px-3 py-2 w-full"
            rows={3}
            placeholder="Observações"
            value={saida.observacao}
            onChange={(e) => setSaida((s) => ({ ...s, observacao: e.target.value }))}
          />

          <div className="flex justify-end">
            <button
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              onClick={registrarSaida}
            >
              Registrar Saída
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
