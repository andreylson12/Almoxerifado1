// src/components/Inventario.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Inventario({ pageSize = 50 }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // id -> contagem digitada
  const [contagens, setContagens] = useState({});
  const [onlyDiff, setOnlyDiff] = useState(false);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  // ---------- Carregar página ----------
  const loadPage = async (pg = page, term = q) => {
    setLoading(true);
    try {
      let query = supabase
        .from("produtos")
        .select("id,codigo,nome,localizacao,quantidade,imagem_url", {
          count: "exact",
        })
        .order("id", { ascending: true })
        .range((pg - 1) * pageSize, (pg - 1) * pageSize + pageSize - 1);

      if (term?.trim()) {
        query = query.or(
          `nome.ilike.%${term.trim()}%,codigo.ilike.%${term.trim()}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setRows(data ?? []);
      setTotal(count ?? 0);
      setPage(pg);
    } catch (e) {
      console.error("Erro ao carregar inventário:", e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Carrega ao montar e ao mudar busca/página
  useEffect(() => {
    loadPage(1, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pageSize]);

  // ---------- Helpers ----------
  const handleChangeCount = (id, value) => {
    const num = value === "" ? "" : Math.max(0, parseInt(value, 10) || 0);
    setContagens((prev) => ({ ...prev, [id]: num }));
  };

  const calcDiff = (p) => {
    const c = contagens[p.id];
    if (c === "" || c === undefined) return null; // sem contagem digitada
    const estoque = Number(p.quantidade ?? 0);
    return Number(c) - estoque;
  };

  // aplica filtro "Somente divergências" na UI (não mexe no backend)
  const visibleRows = useMemo(() => {
    if (!onlyDiff) return rows;
    return rows.filter((p) => {
      const d = calcDiff(p);
      return d !== null && d !== 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, contagens, onlyDiff]);

  // ---------- Export helpers ----------
  const fetchAllForExport = async (term = q) => {
    const step = 1000;
    let all = [];
    let offset = 0;
    let expected = Infinity;

    while (offset < expected) {
      let query = supabase
        .from("produtos")
        .select("id,codigo,nome,localizacao,quantidade", { count: "exact" })
        .order("id", { ascending: true })
        .range(offset, offset + step - 1);

      if (term?.trim()) {
        query = query.or(
          `nome.ilike.%${term.trim()}%,codigo.ilike.%${term.trim()}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      if (expected === Infinity) expected = count ?? step;
      all = all.concat(data ?? []);
      if (!data || data.length < step) break;
      offset += step;
    }

    return all;
  };

  const toCsvValue = (v) => {
    const s = String(v ?? "");
    // escapa aspas e envolve em aspas duplas
    return `"${s.replace(/"/g, '""')}"`;
  };

  const downloadCsv = (filename, rowsToExport) => {
    const header = [
      "id",
      "codigo",
      "nome",
      "localizacao",
      "estoque_sistema",
      "contagem",
      "diferenca",
    ];

    const lines = rowsToExport.map((r) => {
      const cont = contagens[r.id];
      const estoque = Number(r.quantidade ?? 0);
      const diff =
        cont === "" || cont === undefined ? "" : Number(cont) - estoque;

      return [
        toCsvValue(r.id),
        toCsvValue(r.codigo ?? ""),
        toCsvValue(r.nome ?? ""),
        toCsvValue(r.localizacao ?? ""),
        toCsvValue(estoque),
        toCsvValue(cont ?? ""),
        toCsvValue(diff === "" ? "" : diff),
      ].join(",");
    });

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportAll = async () => {
    try {
      const all = await fetchAllForExport(q);
      const ts = new Date().toISOString().slice(0, 10);
      downloadCsv(`inventario-${ts}.csv`, all);
    } catch (e) {
      alert("Falha ao exportar CSV (todos): " + e.message);
    }
  };

  const exportDivergences = async () => {
    try {
      const all = await fetchAllForExport(q);
      const only = all.filter((p) => {
        const c = contagens[p.id];
        if (c === "" || c === undefined) return false;
        return Number(c) !== Number(p.quantidade ?? 0);
      });
      const ts = new Date().toISOString().slice(0, 10);
      downloadCsv(`divergencias-${ts}.csv`, only);
    } catch (e) {
      alert("Falha ao exportar CSV (divergências): " + e.message);
    }
  };

  // ---------- UI ----------
  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <input
          className="border rounded px-3 py-2 w-full md:max-w-sm"
          placeholder="Buscar por nome ou código..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyDiff}
              onChange={(e) => setOnlyDiff(e.target.checked)}
            />
            Somente divergências
          </label>

          <button
            className="px-3 py-2 border rounded hover:bg-gray-50"
            onClick={exportAll}
            title="Exporta todos os itens do filtro (todas as páginas)"
          >
            Exportar CSV (todos)
          </button>
          <button
            className="px-3 py-2 border rounded hover:bg-gray-50"
            onClick={exportDivergences}
            title="Exporta apenas itens onde Contagem ≠ Estoque"
          >
            Exportar CSV (divergências)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg mt-4">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-sm uppercase">
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Localização</th>
              <th className="px-3 py-2 text-center">Estoque</th>
              <th className="px-3 py-2 text-center">Contagem</th>
              <th className="px-3 py-2 text-center">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                  Carregando…
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                  Nenhum item encontrado.
                </td>
              </tr>
            ) : (
              visibleRows.map((p, i) => {
                const diff = calcDiff(p);
                const diffBadge =
                  diff === null
                    ? "bg-gray-100 text-gray-600"
                    : diff === 0
                    ? "bg-green-100 text-green-700"
                    : diff > 0
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700";

                return (
                  <tr
                    key={p.id}
                    className={`${
                      i % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-blue-50 transition`}
                  >
                    <td className="px-3 py-2 text-sm text-gray-600">{p.id}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {p.codigo || "—"}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {p.nome}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {p.localizacao || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {Number(p.quantidade ?? 0)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-24 border rounded px-2 py-1 text-center"
                        value={
                          contagens[p.id] === undefined ? "" : contagens[p.id]
                        }
                        onChange={(e) =>
                          handleChangeCount(p.id, e.target.value)
                        }
                        placeholder="-"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${diffBadge}`}
                      >
                        {diff === null ? "—" : diff}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-sm text-gray-600">
          Total: {total} • Página {page} de {lastPage}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="border rounded px-3 py-1 disabled:opacity-50"
            disabled={page === 1}
            onClick={() => loadPage(1, q)}
          >
            « Primeiro
          </button>
          <button
            className="border rounded px-3 py-1 disabled:opacity-50"
            disabled={page === 1}
            onClick={() => loadPage(page - 1, q)}
          >
            ‹ Anterior
          </button>
          <button
            className="border rounded px-3 py-1 disabled:opacity-50"
            disabled={page >= lastPage}
            onClick={() => loadPage(page + 1, q)}
          >
            Próxima ›
          </button>
          <button
            className="border rounded px-3 py-1 disabled:opacity-50"
            disabled={page >= lastPage}
            onClick={() => loadPage(lastPage, q)}
          >
            Última »
          </button>
        </div>
      </div>
    </div>
  );
}
