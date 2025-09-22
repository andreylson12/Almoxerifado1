// src/components/Plantios.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Loader2 } from "lucide-react";

/** ViewBox (quadro de desenho dos polígonos) */
const VB_W = 1000;
const VB_H = 600;
/** Calibração da área (pixel² -> ha). Ajuste se quiser calibrar com seu croqui. */
const HA_PER_PX2 = 0.001;

/* ===== Helpers geométricos ===== */
function shoelaceAreaPx2(points) {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}
const areaHa = (pts) => shoelaceAreaPx2(pts) * HA_PER_PX2;
const norm = ([x, y]) => [x / VB_W, y / VB_H];
const denorm = ([x, y]) => [x * VB_W, y * VB_H];

/* =================================================================================== */
/* ===============  Talhões Manager (desenha, salva, exclui, escolher)  ============== */
/* =================================================================================== */

function TalhoesManager({ open, onClose, onUseTalhao, onChanged }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ nome: "", area_ha: "", obs: "" });

  const [points, setPoints] = useState([]); // coordenadas no viewBox
  const [drawing, setDrawing] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const polygonPath = points.map(([x, y]) => `${x},${y}`).join(" ");
  const previewHa = points.length >= 3 ? areaHa(points) : 0;

  const fetchTalhoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("talhoes")
      .select("*")
      .order("nome", { ascending: true });
    if (!error) setLista(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchTalhoes();
  }, [open]);

  const startDraw = () => {
    setDrawing(true);
    setPoints([]);
    setForm((f) => ({ ...f, area_ha: "" }));
  };
  const finishDraw = () => {
    setDrawing(false);
    setForm((f) => ({ ...f, area_ha: Number(areaHa(points).toFixed(2)) }));
  };

  const svgPoint = (svg, clientX, clientY) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.max(0, Math.min(VB_W, p.x)), Math.max(0, Math.min(VB_H, p.y))];
  };
  const onSvgClick = (e) => {
    if (!drawing) return;
    const svg = e.currentTarget;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setPoints((prev) => [...prev, [x, y]]);
  };
  const onSvgMouseMove = (e) => {
    if (dragIndex == null) return;
    const svg = e.currentTarget;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setPoints((prev) => {
      const copy = [...prev];
      copy[dragIndex] = [x, y];
      return copy;
    });
  };
  const onSvgMouseUp = () => setDragIndex(null);

  const salvar = async () => {
    if (!form.nome.trim()) return alert("Informe o nome do talhão.");
    if (points.length < 3) return alert("Desenhe o polígono do talhão.");
    const payload = {
      nome: form.nome.trim(),
      area_ha: Number(form.area_ha) || Number(areaHa(points).toFixed(2)),
      obs: form.obs?.trim() || null,
      coords: points.map(norm),
    };
    const { error } = await supabase.from("talhoes").insert([payload]);
    if (error) return alert("Erro ao salvar: " + error.message);

    setForm({ nome: "", area_ha: "", obs: "" });
    setPoints([]);
    setDrawing(false);
    await fetchTalhoes();
    onChanged?.(); // avisa o pai (Plantios) para recarregar dropdown
  };

  const excluir = async (id) => {
    if (!confirm("Excluir este talhão?")) return;
    const { error } = await supabase.from("talhoes").delete().eq("id", id);
    if (error) return alert("Erro ao excluir: " + error.message);
    await fetchTalhoes();
    onChanged?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex">
      {/* painel */}
      <div className="ml-auto w-full max-w-6xl bg-white h-full p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold">Gerenciar talhões</h3>
          <button onClick={onClose} className="px-3 py-1 rounded border">
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Esquerda */}
          <div className="lg:col-span-4">
            <div className="bg-white p-4 rounded-lg border">
              <label className="text-xs text-slate-500">Nome do talhão</label>
              <input
                className="w-full border rounded px-3 py-2 mb-2"
                value={form.nome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nome: e.target.value }))
                }
              />

              <label className="text-xs text-slate-500">
                Área (ha) • Botão: Desenhar polígono
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  className="flex-1 border rounded px-3 py-2"
                  placeholder="preenchida ao finalizar"
                  value={form.area_ha}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, area_ha: e.target.value }))
                  }
                />
                <button
                  className={`px-3 py-2 rounded ${
                    drawing
                      ? "bg-slate-400 text-white"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                  onClick={startDraw}
                  disabled={drawing}
                >
                  Desenhar
                </button>
              </div>

              <label className="text-xs text-slate-500">Observações</label>
              <input
                className="w-full border rounded px-3 py-2 mb-3"
                value={form.obs}
                onChange={(e) =>
                  setForm((f) => ({ ...f, obs: e.target.value }))
                }
              />

              <div className="flex gap-2">
                <button
                  onClick={salvar}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
                >
                  Salvar talhão
                </button>
                <button
                  onClick={() => {
                    setForm({ nome: "", area_ha: "", obs: "" });
                    setPoints([]);
                    setDrawing(false);
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border mt-4">
              <h4 className="font-medium mb-2">
                Talhões cadastrados ({lista.length})
              </h4>
              {loading && (
                <div className="text-sm p-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              )}
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {lista.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between border rounded px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">{t.nome}</div>
                      <div className="text-xs text-slate-500">
                        Área:{" "}
                        {Number(t.area_ha || 0).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        ha
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onUseTalhao?.(t)}
                        className="px-3 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        title="Preencher no formulário de plantio"
                      >
                        Usar
                      </button>
                      <button
                        onClick={() => excluir(t.id)}
                        className="px-3 py-1 rounded border text-red-700 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Direita: quadro */}
          <div className="lg:col-span-8">
            <div className="bg-white p-3 rounded-lg border">
              <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                className="w-full h-[420px] rounded border"
                onClick={onSvgClick}
                onDoubleClick={finishDraw}
                onMouseMove={onSvgMouseMove}
                onMouseUp={onSvgMouseUp}
                style={{
                  backgroundImage:
                    `linear-gradient(to right, rgba(2,6,23,0.04) 1px, transparent 1px),
                     linear-gradient(to bottom, rgba(2,6,23,0.04) 1px, transparent 1px)`,
                  backgroundSize: "32px 32px",
                  cursor: drawing ? "crosshair" : "default",
                }}
              >
                {points.length >= 2 && drawing && (
                  <polyline
                    points={polygonPath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                  />
                )}
                {points.length >= 3 && !drawing && (
                  <polygon
                    points={polygonPath}
                    fill="rgba(16,185,129,0.35)"
                    stroke="#10b981"
                    strokeWidth="3"
                  />
                )}
                {points.map(([x, y], idx) => (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={6}
                    fill="#10b981"
                    stroke="white"
                    strokeWidth="2"
                    onMouseDown={() => setDragIndex(idx)}
                  />
                ))}
              </svg>

              <div className="flex items-center justify-between mt-2 text-sm">
                <p className="text-slate-600">
                  Clique em <b>Desenhar</b> e marque os vértices. Duplo-clique
                  para finalizar. Arraste os pontos para ajustar.
                </p>
                <div className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">
                  Área estimada:{" "}
                  {previewHa
                    ? previewHa.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })
                    : "—"}{" "}
                  ha
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                * Estimativa sem mapa. Para calibrar, ajuste{" "}
                <code>HA_PER_PX2</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================================== */
/* ==================================  PLANTIOS  ==================================== */
/* =================================================================================== */

export default function Plantios() {
  // lista de plantios
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // talhões para dropdown & preview
  const [talhoes, setTalhoes] = useState([]);
  const [talhoesOpen, setTalhoesOpen] = useState(false);
  const [previewPoints, setPreviewPoints] = useState([]); // denormalizado

  // form plantio
  const [form, setForm] = useState({
    cultura: "",
    variedade: "",
    safra: "",
    talhao: "",
    area_ha: "",
    data_plantio: "",
    espacamento: "",
    populacao_ha: "",
    obs: "",
  });

  const setF = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  /* ---------- fetch ---------- */
  const fetchPlantios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("plantios")
      .select("*")
      .order("data_plantio", { ascending: false })
      .order("id", { ascending: false });
    if (!error) setRows(data || []);
    setLoading(false);
  };

  const fetchTalhoes = async () => {
    const { data } = await supabase
      .from("talhoes")
      .select("*")
      .order("nome", { ascending: true });
    setTalhoes(data || []);
  };

  useEffect(() => {
    fetchPlantios();
    fetchTalhoes();
  }, []);

  /* ---------- selecionar talhão (dropdown) ---------- */
  const onSelectTalhaoId = (id) => {
    const t = talhoes.find((x) => x.id === Number(id));
    if (!t) {
      setF("talhao", "");
      setF("area_ha", "");
      setPreviewPoints([]);
      return;
    }
    setF("talhao", t.nome);
    setF("area_ha", Number(t.area_ha || 0));
    try {
      const pts = (t.coords || []).map(denorm);
      setPreviewPoints(pts);
    } catch {
      setPreviewPoints([]);
    }
  };

  /* ---------- CRUD plantio ---------- */
  const addPlantio = async () => {
    try {
      if (!form.cultura.trim()) return alert("Informe a cultura.");
      if (!form.data_plantio) return alert("Informe a data.");

      const payload = {
        cultura: form.cultura || null,
        variedade: form.variedade || null,
        safra: form.safra || null,
        talhao: form.talhao || null, // texto (preenchido via dropdown/usar)
        area_ha: form.area_ha ? Number(form.area_ha) : null,
        data_plantio: form.data_plantio || null,
        espacamento: form.espacamento ? Number(form.espacamento) : null,
        populacao_ha: form.populacao_ha ? Number(form.populacao_ha) : null,
        obs: form.obs || null,
      };

      const { error } = await supabase.from("plantios").insert([payload]);
      if (error) throw error;

      setForm({
        cultura: form.cultura,
        variedade: "",
        safra: form.safra,
        talhao: "",
        area_ha: "",
        data_plantio: "",
        espacamento: "",
        populacao_ha: "",
        obs: "",
      });
      setPreviewPoints([]);
      fetchPlantios();
      alert("Plantio salvo.");
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar plantio: " + e.message);
    }
  };

  const delPlantio = async (row) => {
    if (!confirm("Excluir este plantio?")) return;
    const { error } = await supabase.from("plantios").delete().eq("id", row.id);
    if (!error) fetchPlantios();
  };

  /* ---------- quando usar talhão pelo Manager ---------- */
  const handleUseTalhao = (t) => {
    setF("talhao", t.nome);
    setF("area_ha", Number(t.area_ha || 0));
    try {
      const pts = (t.coords || []).map(denorm);
      setPreviewPoints(pts);
    } catch {
      setPreviewPoints([]);
    }
    setTalhoesOpen(false);
  };

  const polygonPath = useMemo(
    () => previewPoints.map(([x, y]) => `${x},${y}`).join(" "),
    [previewPoints]
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl md:text-3xl font-bold">Plantios</h2>

      {/* Formulário + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5">
          <div className="bg-white p-4 rounded-lg shadow space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="border rounded px-3 py-2"
                placeholder="Cultura (ex: Soja)"
                value={form.cultura}
                onChange={(e) => setF("cultura", e.target.value)}
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="Variedade"
                value={form.variedade}
                onChange={(e) => setF("variedade", e.target.value)}
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="Safra (ex: 24/25)"
                value={form.safra}
                onChange={(e) => setF("safra", e.target.value)}
              />
              <input
                type="date"
                className="border rounded px-3 py-2"
                value={form.data_plantio}
                onChange={(e) => setF("data_plantio", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 flex gap-2">
                <select
                  className="border rounded px-3 py-2 flex-1"
                  value={
                    talhoes.find((t) => t.nome === form.talhao)?.id ?? ""
                  }
                  onChange={(e) => onSelectTalhaoId(e.target.value)}
                >
                  <option value="">— selecione um talhão —</option>
                  {talhoes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({Number(t.area_ha || 0).toLocaleString()} ha)
                    </option>
                  ))}
                </select>

                <button
                  className="px-3 py-2 rounded border hover:bg-slate-50"
                  onClick={() => setTalhoesOpen(true)}
                >
                  Gerenciar talhões
                </button>
              </div>

              <input
                className="border rounded px-3 py-2"
                placeholder="Área (ha)"
                type="number"
                value={form.area_ha}
                onChange={(e) => setF("area_ha", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="border rounded px-3 py-2"
                placeholder="Espaçamento"
                type="number"
                value={form.espacamento}
                onChange={(e) => setF("espacamento", e.target.value)}
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="População/ha"
                type="number"
                value={form.populacao_ha}
                onChange={(e) => setF("populacao_ha", e.target.value)}
              />
            </div>

            <textarea
              className="border rounded px-3 py-2 w-full"
              rows={2}
              placeholder="Observações"
              value={form.obs}
              onChange={(e) => setF("obs", e.target.value)}
            />

            <div className="flex justify-end">
              <button
                onClick={addPlantio}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Salvar plantio
              </button>
            </div>
          </div>
        </div>

        {/* Preview do talhão selecionado */}
        <div className="lg:col-span-7">
          <div className="bg-white p-3 rounded-lg shadow">
            <div className="text-sm text-slate-600 mb-2">
              Preview do talhão selecionado
            </div>
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="w-full h-[320px] rounded border"
              style={{
                backgroundImage:
                  `linear-gradient(to right, rgba(2,6,23,0.04) 1px, transparent 1px),
                   linear-gradient(to bottom, rgba(2,6,23,0.04) 1px, transparent 1px)`,
                backgroundSize: "32px 32px",
              }}
            >
              {previewPoints.length >= 3 ? (
                <polygon
                  points={polygonPath}
                  fill="rgba(59,130,246,0.25)"
                  stroke="#3b82f6"
                  strokeWidth="3"
                />
              ) : (
                <text x="16" y="28" className="fill-slate-400 text-sm">
                  Nenhum talhão selecionado.
                </text>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* Lista de plantios */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-3">Plantios cadastrados</h3>
        {loading ? (
          <div className="p-3 text-slate-600 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-3 text-slate-500">Nenhum plantio.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Cultura</th>
                  <th className="p-2 text-left">Variedade</th>
                  <th className="p-2 text-left">Safra</th>
                  <th className="p-2 text-left">Talhão</th>
                  <th className="p-2 text-right">Área (ha)</th>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Espaçamento</th>
                  <th className="p-2 text-left">População/ha</th>
                  <th className="p-2 text-left">Obs</th>
                  <th className="p-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.cultura || "—"}</td>
                    <td className="p-2">{r.variedade || "—"}</td>
                    <td className="p-2">{r.safra || "—"}</td>
                    <td className="p-2">{r.talhao || "—"}</td>
                    <td className="p-2 text-right">
                      {Number(r.area_ha || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-2">{r.data_plantio || "—"}</td>
                    <td className="p-2">{r.espacamento ?? "—"}</td>
                    <td className="p-2">{r.populacao_ha ?? "—"}</td>
                    <td className="p-2">{r.obs || "—"}</td>
                    <td className="p-2">
                      <button
                        onClick={() => delPlantio(r)}
                        className="px-3 py-1 rounded border text-red-700 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer de Talhões */}
      <TalhoesManager
        open={talhoesOpen}
        onClose={() => setTalhoesOpen(false)}
        onUseTalhao={handleUseTalhao}
        onChanged={fetchTalhoes}
      />
    </div>
  );
}
