import { useState } from "react";
import { supabase } from "../supabaseClient";

const TIPOS = ["Herbicida", "Fungicida", "Inseticida", "Acaricida", "Nematicida", "Adjuvante", "Outro"];

export default function NFImportDef({ onAfterImport }) {
  const [xmlInfo, setXmlInfo] = useState(null); // {nf, fornecedor, itens:[{nome, quantidade, unidade, tipo}]}
  const [loading, setLoading] = useState(false);

  const parseXml = async (file) => {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");

    const ide = doc.querySelector("ide");
    const emit = doc.querySelector("emit");

    const nf = ide?.querySelector("nNF")?.textContent || "";
    const fornecedor = emit?.querySelector("xNome")?.textContent || "";

    const dets = Array.from(doc.querySelectorAll("det"));
    const itens = dets.map((d) => {
      const prod = d.querySelector("prod");
      const nome = prod?.querySelector("xProd")?.textContent?.trim() || "";
      const unidade = prod?.querySelector("uCom")?.textContent?.trim() || "UN";
      const quantidade = Number(prod?.querySelector("qCom")?.textContent?.replace(",", ".") || "0");
      return { nome, unidade, quantidade, tipo: "Herbicida" }; // tipo default editável na UI
    });

    setXmlInfo({ nf, fornecedor, itens });
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xml")) {
      alert("Envie o XML da NF-e.");
      return;
    }
    parseXml(f);
  };

  const salvar = async () => {
    if (!xmlInfo?.itens?.length) return;
    setLoading(true);

    try {
      // upsert de todos os produtos por nome
      for (const item of xmlInfo.itens) {
        // 1) upsert do cadastro
        const { data: upserted, error: upsertErr } = await supabase
          .from("defensivos")
          .upsert([{
            nome: item.nome,
            tipo: item.tipo,
            unidade: item.unidade,
          }], { onConflict: "nome" })
          .select();

        if (upsertErr || !upserted?.[0]) throw upsertErr || new Error("Falha no upsert");
        const def = upserted[0];

        // 2) atualiza estoque (soma)
        const { data: atual, error: getErr } = await supabase
          .from("defensivos")
          .select("id, quantidade")
          .eq("id", def.id)
          .single();
        if (getErr || !atual) throw getErr || new Error("Falha ao ler estoque");

        const novaQt = Number(atual.quantidade ?? 0) + Number(item.quantidade ?? 0);
        const { error: updErr } = await supabase
          .from("defensivos")
          .update({ quantidade: novaQt })
          .eq("id", def.id);
        if (updErr) throw updErr;

        // 3) registra movimentação (Entrada, origem NF)
        const { error: movErr } = await supabase
          .from("defensivo_movimentacoes")
          .insert([{
            tipo: "Entrada",
            defensivo_id: def.id,
            quantidade: item.quantidade,
            unidade: item.unidade,
            origem: "NF",
            nf_numero: xmlInfo.nf,
            fornecedor: xmlInfo.fornecedor,
          }]);
        if (movErr) throw movErr;
      }

      alert("NF importada com sucesso!");
      setXmlInfo(null);
      onAfterImport?.();
    } catch (err) {
      console.error(err);
      alert("Falha ao importar NF.");
    } finally {
      setLoading(false);
    }
  };

  const updateTipo = (idx, novo) => {
    setXmlInfo((s) => ({
      ...s,
      itens: s.itens.map((it, i) => i===idx ? { ...it, tipo: novo } : it)
    }));
  };

  if (!xmlInfo) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Importar NF-e (XML) – Defensivos</h2>
        <input type="file" accept=".xml" onChange={handleFile} />
        <p className="text-sm text-gray-500 mt-2">
          Dica: peça ao fornecedor o <strong>XML</strong> da NF. É o arquivo oficial da NF-e.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Pré-visualização</h2>
        <button className="text-sm text-blue-600" onClick={()=>setXmlInfo(null)}>Trocar arquivo</button>
      </div>
      <p className="text-sm text-gray-600 mt-1">
        NF: <strong>{xmlInfo.nf || "—"}</strong> • Fornecedor: <strong>{xmlInfo.fornecedor || "—"}</strong>
      </p>

      <div className="overflow-x-auto rounded-lg border mt-3">
        <table className="w-full bg-white">
          <thead>
            <tr className="bg-gray-100 text-sm">
              <th className="p-2 text-left">Nome</th>
              <th className="p-2 text-left">Unid.</th>
              <th className="p-2 text-left">Quantidade</th>
              <th className="p-2 text-left">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {xmlInfo.itens.map((it, i) => (
              <tr key={i} className={i%2===0?"bg-gray-50":""}>
                <td className="p-2">{it.nome}</td>
                <td className="p-2">{it.unidade}</td>
                <td className="p-2">{it.quantidade}</td>
                <td className="p-2">
                  <select className="border rounded px-2 py-1"
                          value={it.tipo}
                          onChange={(e)=>updateTipo(i, e.target.value)}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        disabled={loading}
        onClick={salvar}
        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
      >
        {loading ? "Lançando..." : "Lançar Entradas"}
      </button>
    </div>
  );
}
