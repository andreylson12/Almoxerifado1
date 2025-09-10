import { useState } from "react";
import { supabase } from "../supabaseClient";
import { inferTipoFromNcm } from "../lib/ncmMap";

function parseXmlText(xmlText) {
  const xml = new window.DOMParser().parseFromString(xmlText, "text/xml");
  const infNFe = xml.querySelector("infNFe,infNFeSupl") || xml;
  const emit = xml.querySelector("emit");
  const ide  = xml.querySelector("ide");
  const nNF  = (ide?.querySelector("nNF")?.textContent || "").trim();
  const fornecedor = (emit?.querySelector("xNome")?.textContent || "").trim();

  const dets = Array.from(xml.querySelectorAll("det"));
  const itens = dets.map((det, i) => {
    const prod = det.querySelector("prod");
    const xProd = (prod?.querySelector("xProd")?.textContent || "").trim();
    const NCM   = (prod?.querySelector("NCM")?.textContent || "").trim();
    const uTrib = (prod?.querySelector("uTrib")?.textContent || "").trim() || (prod?.querySelector("uCom")?.textContent || "").trim();
    const qTrib = Number((prod?.querySelector("qTrib")?.textContent || prod?.querySelector("qCom")?.textContent || "0").replace(",", "."));
    const vUnTrib = Number((prod?.querySelector("vUnTrib")?.textContent || prod?.querySelector("vUnCom")?.textContent || "0").replace(",", "."));

    const rastros = Array.from(prod?.querySelectorAll("rastro") || []).map(r => ({
      lote: (r.querySelector("nLote")?.textContent || "").trim(),
      qLote: Number((r.querySelector("qLote")?.textContent || "0").replace(",", ".")),
      dFab: (r.querySelector("dFab")?.textContent || "").trim(),
      dVal: (r.querySelector("dVal")?.textContent || "").trim(),
    }));

    const sugest = inferTipoFromNcm(NCM, xProd);

    return {
      idx: i + 1,
      nome: xProd,
      ncm: NCM,
      unidade: uTrib || null,
      quantidade: qTrib || 0,
      vUnitario: vUnTrib || 0,
      lotes: rastros,
      tipo_sugerido: sugest.tipo,
      nf_numero: nNF,
      fornecedor,
    };
  });

  return { nNF, fornecedor, itens };
}

export default function DefensivosImportXML() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ nf: "", fornecedor: "" });
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files) => {
    const all = [];
    let lastNF = "", lastFornecedor = "";
    for (const f of files) {
      const text = await f.text();
      const { nNF, fornecedor, itens } = parseXmlText(text);
      all.push(...itens);
      lastNF = nNF || lastNF;
      lastFornecedor = fornecedor || lastFornecedor;
    }
    setRows(all);
    setMeta({ nf: lastNF, fornecedor: lastFornecedor });
  };

  const salvar = async () => {
    if (!rows.length) return alert("Nenhum item carregado.");
    setBusy(true);
    try {
      // 1) upsert na tabela "defensivos" por nome
      const defensivosPayload = rows.map(r => ({
        nome: r.nome,
        ncm: r.ncm?.replace(/\D/g, "") || null,
        tipo: r.tipo_sugerido || "Outro",
        unidade: r.unidade || null,
      }));

      const { data: upDef, error: upErr } = await supabase
        .from("defensivos")
        .upsert(defensivosPayload, { onConflict: "nome" })
        .select("id,nome");

      if (upErr) throw upErr;

      // cria um map nome → id
      const idByNome = new Map(upDef.map(d => [d.nome, d.id]));

      // 2) cria entradas de movimentação (uma por lote, senão uma por item)
      const movs = [];
      for (const r of rows) {
        const defensivo_id = idByNome.get(r.nome);
        if (!defensivo_id) continue;

        if (r.lotes && r.lotes.length) {
          r.lotes.forEach(L => {
            movs.push({
              tipo: "Entrada",
              defensivo_id,
              quantidade: Number(L.qLote || 0),
              unidade: r.unidade || null,
              origem: "NF-e",
              nf_numero: r.nf_numero || meta.nf || null,
              fornecedor: r.fornecedor || meta.fornecedor || null,
              lote: L.lote || null,
              validade: L.dVal || null,
              fabricacao: L.dFab || null,
            });
          });
        } else {
          movs.push({
            tipo: "Entrada",
            defensivo_id,
            quantidade: Number(r.quantidade || 0),
            unidade: r.unidade || null,
            origem: "NF-e",
            nf_numero: r.nf_numero || meta.nf || null,
            fornecedor: r.fornecedor || meta.fornecedor || null,
            lote: null,
            validade: null,
            fabricacao: null,
          });
        }
      }

      if (movs.length) {
        const { error: movErr } = await supabase
          .from("defensivo_movimentacoes")
          .insert(movs);
        if (movErr) throw movErr;
      }

      alert("XML importado com sucesso!");
      setRows([]);
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar: " + (e.message || e.toString()));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold">Importar NF-e (XML)</h2>

      <input
        type="file"
        accept=".xml"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="block"
      />

      {rows.length > 0 && (
        <>
          <div className="text-sm text-gray-600">
            NF: <b>{meta.nf || "—"}</b> • Fornecedor: <b>{meta.fornecedor || "—"}</b> • Itens: <b>{rows.length}</b>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2 border">Produto</th>
                  <th className="p-2 border">NCM</th>
                  <th className="p-2 border">Unid.</th>
                  <th className="p-2 border">Qtd.</th>
                  <th className="p-2 border">Tipo (sugerido)</th>
                  <th className="p-2 border">Lotes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="p-2 border">{r.nome}</td>
                    <td className="p-2 border">{r.ncm || "—"}</td>
                    <td className="p-2 border">{r.unidade || "—"}</td>
                    <td className="p-2 border">{r.quantidade}</td>
                    <td className="p-2 border">
                      <select
                        value={r.tipo_sugerido}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRows((old) => old.map((x, idx) => idx === i ? { ...x, tipo_sugerido: val } : x));
                        }}
                        className="border rounded px-2 py-1"
                      >
                        {["Herbicida","Fungicida","Inseticida","Acaricida","Nematicida","Adjuvante","Fertilizante","Desinfetante","Outro"]
                          .map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border">
                      {r.lotes?.length
                        ? r.lotes.map((L, j) => (
                            <div key={j} className="text-xs">
                              <b>{L.lote}</b> — {L.qLote} {r.unidade} • Val: {L.dVal || "—"}
                            </div>
                          ))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            disabled={busy}
            onClick={salvar}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {busy ? "Salvando…" : "Salvar no banco"}
          </button>
        </>
      )}
    </div>
  );
}
