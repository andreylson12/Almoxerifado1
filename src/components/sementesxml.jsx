// src/components/SementesXML.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2 } from "lucide-react";

function parseNFeXml(xmlText) {
  // Retorna { header, items }
  // header: { chave, numero, serie, emissao, emitente, cnpj_emit }
  // items: [{ nItem, cProd, xProd, uCom, qCom, vUnCom }]
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");

  const get = (sel) => doc.querySelector(sel)?.textContent?.trim() || "";

  const header = {
    chave: get("infNFe"),
    numero: get("ide > nNF"),
    serie: get("ide > serie"),
    emissao: get("ide > dhEmi") || get("ide > dEmi"),
    emitente: get("emit > xNome"),
    cnpj_emit: get("emit > CNPJ") || get("emit > CPF"),
  };

  // Normaliza data (pega só AAAA-MM-DD)
  if (header.emissao && header.emissao.length >= 10) {
    header.emissao = header.emissao.slice(0, 10);
  }

  const items = [];
  doc.querySelectorAll("det").forEach((det) => {
    const nItem = det.getAttribute("nItem") || "";
    const cProd = det.querySelector("prod > cProd")?.textContent?.trim() || "";
    const xProd = det.querySelector("prod > xProd")?.textContent?.trim() || "";
    const uCom = det.querySelector("prod > uCom")?.textContent?.trim() || "";
    const qCom = det.querySelector("prod > qCom")?.textContent?.trim() || "";
    const vUnCom = det.querySelector("prod > vUnCom")?.textContent?.trim() || "";

    items.push({
      nItem: Number(nItem || 0),
      cProd,
      xProd,
      uCom,
      qCom: Number(qCom || 0),
      vUnCom: Number(vUnCom || 0),
      kg_total: uCom.toUpperCase() === "KG" ? Number(qCom || 0) : 0, // se vier KG, já preenche
      lote: "",
      tratamento: "",
    });
  });

  return { header, items };
}

export default function SementesXML() {
  // Fazendas / talhões / plantios (para alocação)
  const [fazendas, setFazendas] = useState([]);
  const [talhoes, setTalhoes] = useState([]);
  const [plantios, setPlantios] = useState([]);

  const [fazendaIdAloc, setFazendaIdAloc] = useState("");
  const [talhaoAloc, setTalhaoAloc] = useState("");
  const [plantioIdAloc, setPlantioIdAloc] = useState("");

  // Upload / Preview
  const [xmlText, setXmlText] = useState("");
  const [header, setHeader] = useState(null);
  const [previewItems, setPreviewItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // Notas existentes + itens + saldos
  const [notas, setNotas] = useState([]);
  const [itens, setItens] = useState([]);
  const [alocacoes, setAlocacoes] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Alocação (quantidade e janela)
  const [alocItem, setAlocItem] = useState(null); // item selecionado para alocação
  const [alocKg, setAlocKg] = useState("");
  const [alocObs, setAlocObs] = useState("");

  /* ======= Fetch básicos ======= */
  const fetchFazendas = async () => {
    const { data } = await supabase.from("fazendas").select("*").order("nome");
    setFazendas(data || []);
    if (!fazendaIdAloc && data?.length) setFazendaIdAloc(String(data[0].id));
  };

  const fetchTalhoes = async (fid) => {
    if (!fid) return setTalhoes([]);
    const { data } = await supabase.from("talhoes").select("*").eq("fazenda_id", fid).order("nome");
    setTalhoes(data || []);
  };

  const fetchPlantios = async (fid) => {
    if (!fid) return setPlantios([]);
    const { data } = await supabase
      .from("plantios")
      .select("*")
      .eq("fazenda_id", fid)
      .order("data_plantio", { ascending: false });
    setPlantios(data || []);
  };

  useEffect(() => {
    fetchFazendas();
  }, []);
  useEffect(() => {
    if (!fazendaIdAloc) return;
    fetchTalhoes(fazendaIdAloc);
    fetchPlantios(fazendaIdAloc);
  }, [fazendaIdAloc]);

  const fetchLista = async () => {
    setLoadingList(true);
    try {
      const { data: n } = await supabase
        .from("sementes_notas")
        .select("*")
        .order("created_at", { ascending: false });
      setNotas(n || []);

      const { data: it } = await supabase
        .from("sementes_itens")
        .select("*")
        .order("id", { ascending: true });
      setItens(it || []);

      const { data: al } = await supabase
        .from("sementes_alocacoes")
        .select("*")
        .order("created_at", { ascending: true });
      setAlocacoes(al || []);
    } finally {
      setLoadingList(false);
    }
  };
  useEffect(() => {
    fetchLista();
  }, []);

  /* ======= Upload & Parse ======= */
  const onSelectXml = async (file) => {
    if (!file) return;
    const text = await file.text();
    setXmlText(text);
    const parsed = parseNFeXml(text);
    setHeader(parsed.header);
    setPreviewItems(parsed.items);
  };

  const updatePreviewItem = (idx, patch) => {
    setPreviewItems((arr) => {
      const cp = [...arr];
      cp[idx] = { ...cp[idx], ...patch };
      return cp;
    });
  };

  /* ======= Persistência ======= */
  const salvarImportacao = async () => {
    if (!header || !previewItems.length) return alert("Selecione um XML válido.");

    setSaving(true);
    try {
      const { data: notaRows, error: e1 } = await supabase
        .from("sementes_notas")
        .insert([
          {
            fazenda_id: fazendaIdAloc ? Number(fazendaIdAloc) : null,
            chave: header.chave || null,
            numero: header.numero || null,
            serie: header.serie || null,
            emissao: header.emissao || null,
            emitente: header.emitente || null,
            cnpj_emit: header.cnpj_emit || null,
            arquivo_xml: xmlText || null,
          },
        ])
        .select();
      if (e1) throw e1;

      const nota = notaRows[0];

      // monta itens
      const itensPayload = previewItems.map((it) => ({
        nota_id: nota.id,
        nitem: it.nItem || null,
        cprod: it.cProd || it.cprod || null,
        xprod: it.xProd || it.xprod || null,
        ucom: it.uCom || it.ucom || null,
        qcom: it.qCom || it.qcom || null,
        vuncom: it.vUnCom || it.vuncom || null,
        kg_total: it.kg_total ? Number(it.kg_total) : null,
        lote: it.lote || null,
        tratamento: it.tratamento || null,
      }));

      const { error: e2 } = await supabase.from("sementes_itens").insert(itensPayload);
      if (e2) throw e2;

      // limpa preview e recarrega listas
      setXmlText("");
      setHeader(null);
      setPreviewItems([]);
      await fetchLista();
      alert("XML importado com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar importação.");
    } finally {
      setSaving(false);
    }
  };

  /* ======= Saldos / Alocação ======= */
  const alocacoesPorItem = useMemo(() => {
    const map = new Map();
    for (const a of alocacoes) {
      const key = String(a.item_id);
      map.set(key, (map.get(key) || 0) + Number(a.quantidade_kg || 0));
    }
    return map;
  }, [alocacoes]);

  const itensComSaldo = useMemo(() => {
    return itens.map((it) => {
      const usado = alocacoesPorItem.get(String(it.id)) || 0;
      const saldo = Number(it.kg_total || 0) - usado;
      return { ...it, usado, saldo };
    });
  }, [itens, alocacoesPorItem]);

  const abrirAlocacao = (item) => {
    setAlocItem(item);
    setAlocKg("");
    setAlocObs("");
  };

  const salvarAlocacao = async () => {
    if (!alocItem) return;
    if (!fazendaIdAloc) return alert("Selecione a fazenda para alocar.");
    if (!talhaoAloc) return alert("Informe o talhão.");
    const q = Number(alocKg || 0);
    if (q <= 0) return alert("Informe a quantidade (kg) a alocar.");

    // valida saldo
    if (q > Number(alocItem.saldo || 0)) {
      return alert("Quantidade maior que o saldo do item.");
    }

    const payload = {
      item_id: alocItem.id,
      fazenda_id: Number(fazendaIdAloc),
      talhao: talhaoAloc,
      plantio_id: plantioIdAloc ? Number(plantioIdAloc) : null,
      quantidade_kg: q,
      obs: alocObs || null,
    };

    const { error } = await supabase.from("sementes_alocacoes").insert([payload]);
    if (error) {
      console.error(error);
      return alert("Falha ao salvar alocação.");
    }

    // refresh
    await fetchLista();
    setAlocItem(null);
    setAlocKg("");
    setAlocObs("");
  };

  /* ======= UI ======= */
  return (
    <div className="space-y-6">
      {/* Importação XML */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <h3 className="font-semibold text-lg">Importar NF-e (XML) de sementes</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-slate-600">XML da NF-e</label>
            <input
              type="file"
              accept=".xml"
              className="border rounded px-3 py-2 w-full"
              onChange={(e) => onSelectXml(e.target.files?.[0])}
            />
          </div>

          <div>
            <label className="text-xs text-slate-600">Fazenda (padrão para a nota)</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={fazendaIdAloc}
              onChange={(e) => setFazendaIdAloc(e.target.value)}
            >
              {fazendas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              disabled={!header || !previewItems.length || saving}
              onClick={salvarImportacao}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
                </span>
              ) : (
                "Salvar importação"
              )}
            </button>
          </div>
        </div>

        {/* Preview do XML */}
        {header && (
          <div className="mt-3 p-3 bg-slate-50 rounded text-sm">
            <div className="font-medium">
              NF {header.numero || "—"}/{header.serie || "—"} • Emissão: {header.emissao || "—"}
            </div>
            <div>Emitente: {header.emitente || "—"} • CNPJ: {header.cnpj_emit || "—"}</div>
          </div>
        )}

        {previewItems.length > 0 && (
          <div className="overflow-x-auto rounded border mt-3">
            <table className="w-full bg-white text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2 text-left">Produto</th>
                  <th className="p-2 text-left">uCom</th>
                  <th className="p-2 text-right">qCom</th>
                  <th className="p-2 text-right">Kg (ajustar)</th>
                  <th className="p-2 text-left">Lote</th>
                  <th className="p-2 text-left">Tratamento</th>
                </tr>
              </thead>
              <tbody>
                {previewItems.map((it, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{it.nItem}</td>
                    <td className="p-2">{it.xProd}</td>
                    <td className="p-2">{it.uCom}</td>
                    <td className="p-2 text-right">{Number(it.qCom || 0).toLocaleString()}</td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        className="border rounded px-2 py-1 w-28 text-right"
                        value={it.kg_total}
                        onChange={(e) => updatePreviewItem(idx, { kg_total: Number(e.target.value || 0) })}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="border rounded px-2 py-1 w-40"
                        value={it.lote || ""}
                        onChange={(e) => updatePreviewItem(idx, { lote: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="border rounded px-2 py-1 w-40"
                        value={it.tratamento || ""}
                        onChange={(e) => updatePreviewItem(idx, { tratamento: e.target.value })}
                        placeholder="TSI / Local"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Itens importados + Saldos + Alocação */}
      <div className="bg-white p-4 rounded-lg shadow space-y-3">
        <h3 className="font-semibold text-lg">Itens importados & alocação</h3>

        {/* Filtros de alocação */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-600">Fazenda</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={fazendaIdAloc}
              onChange={(e) => setFazendaIdAloc(e.target.value)}
            >
              {fazendas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Talhão</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={talhaoAloc}
              onChange={(e) => setTalhaoAloc(e.target.value)}
            >
              <option value="">Selecione…</option>
              {talhoes.map((t) => (
                <option key={t.id} value={t.nome}>
                  {t.nome} {t.area_ha ? `• ${t.area_ha} ha` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Plantio (opcional)</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={plantioIdAloc}
              onChange={(e) => setPlantioIdAloc(e.target.value)}
            >
              <option value="">—</option>
              {plantios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data_plantio} • {p.cultura || "—"} • {p.talhao || "—"}
                </option>
              ))}
            </select>
          </div>
          <div />
        </div>

        {/* Lista itens */}
        {loadingList ? (
          <div className="p-4 text-slate-600 inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            {notas.map((n) => {
              const itensDaNota = itensComSaldo.filter((it) => it.nota_id === n.id);
              if (!itensDaNota.length) return null;
              return (
                <div key={n.id} className="mt-3 border rounded overflow-x-auto">
                  <div className="p-3 bg-slate-50 text-sm">
                    <div className="font-medium">
                      NF {n.numero || "—"}/{n.serie || "—"} • {n.emissao || "—"} • {n.emitente || "—"}
                    </div>
                    <div className="text-slate-600">Chave: {n.chave || "—"}</div>
                  </div>

                  <table className="w-full bg-white text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-left">Lote</th>
                        <th className="p-2 text-left">Tratamento</th>
                        <th className="p-2 text-right">KG total</th>
                        <th className="p-2 text-right">Alocado</th>
                        <th className="p-2 text-right">Saldo</th>
                        <th className="p-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensDaNota.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2">{it.nitem}</td>
                          <td className="p-2">{it.xprod || "—"}</td>
                          <td className="p-2">{it.lote || "—"}</td>
                          <td className="p-2">{it.tratamento || "—"}</td>
                          <td className="p-2 text-right">
                            {Number(it.kg_total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-right">
                            {Number(it.usado || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-right">
                            {Number(it.saldo || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              disabled={Number(it.saldo || 0) <= 0}
                              onClick={() => abrirAlocacao(it)}
                              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                            >
                              Alocar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* mini-tabela com alocações desse conjunto de itens */}
                  <div className="border-t">
                    <table className="w-full bg-white text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-2 text-left">ItemID</th>
                          <th className="p-2 text-left">Fazenda</th>
                          <th className="p-2 text-left">Talhão</th>
                          <th className="p-2 text-left">Plantio</th>
                          <th className="p-2 text-right">KG</th>
                          <th className="p-2 text-left">Obs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alocacoes
                          .filter((a) => itensDaNota.some((it) => it.id === a.item_id))
                          .map((a) => {
                            const fz = fazendas.find((f) => String(f.id) === String(a.fazenda_id));
                            const pl = plantios.find((p) => String(p.id) === String(a.plantio_id));
                            return (
                              <tr key={a.id} className="border-t">
                                <td className="p-2">{a.item_id}</td>
                                <td className="p-2">{fz ? fz.nome : a.fazenda_id}</td>
                                <td className="p-2">{a.talhao || "—"}</td>
                                <td className="p-2">
                                  {pl ? `${pl.data_plantio} • ${pl.cultura || "—"} • ${pl.talhao || "—"}` : "—"}
                                </td>
                                <td className="p-2 text-right">
                                  {Number(a.quantidade_kg || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-2">{a.obs || "—"}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Drawer simples de alocação */}
        {alocItem && (
          <div className="mt-4 p-3 border rounded bg-slate-50">
            <div className="font-medium mb-2">
              Alocar item #{alocItem.id} • {alocItem.xprod || "—"} • Saldo:{" "}
              {Number(alocItem.saldo || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <select
                className="border rounded px-3 py-2"
                value={fazendaIdAloc}
                onChange={(e) => setFazendaIdAloc(e.target.value)}
              >
                {fazendas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-3 py-2"
                value={talhaoAloc}
                onChange={(e) => setTalhaoAloc(e.target.value)}
              >
                <option value="">Talhão…</option>
                {talhoes.map((t) => (
                  <option key={t.id} value={t.nome}>
                    {t.nome} {t.area_ha ? `• ${t.area_ha} ha` : ""}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-3 py-2"
                value={plantioIdAloc}
                onChange={(e) => setPlantioIdAloc(e.target.value)}
              >
                <option value="">Plantio (opcional)…</option>
                {plantios
                  .filter((p) => !talhaoAloc || (p.talhao || "").toLowerCase() === talhaoAloc.toLowerCase())
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.data_plantio} • {p.cultura || "—"} • {p.talhao || "—"}
                    </option>
                  ))}
              </select>

              <input
                type="number"
                className="border rounded px-3 py-2"
                placeholder="Quantidade (kg)"
                value={alocKg}
                onChange={(e) => setAlocKg(e.target.value)}
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="Observação (opcional)"
                value={alocObs}
                onChange={(e) => setAlocObs(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setAlocItem(null)}
                className="px-4 py-2 rounded border hover:bg-white"
              >
                Cancelar
              </button>
              <button
                onClick={salvarAlocacao}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Salvar alocação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
