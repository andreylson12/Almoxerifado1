import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Inventario({ pageSize = 50 }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // mapa: { [produtoId]: quantidadeContada }
  const [contagens, setContagens] = useState({});

  // fetch paginado do Supabase
  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const from = (page - 1) * size;
        const to = from + size - 1;

        let query = supabase
          .from("produtos")
          .select("id,codigo,nome,localizacao,quantidade", { count: "exact" })
          .order("id", { ascending: true })
          .range(from, to);

        if (q.trim()) {
          query = query.or(
            `nome.ilike.%${q.trim()}%,codigo.ilike.%${q.trim()}%`
          );
        }

        const { data, count, error } = await query;
        if (error) throw error;

        setRows(data ?? []);
        setTotal(count ?? 0);
      } catch (e) {
        console.error(e);
        setErrorMsg("Falha ao carregar produtos.");
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [page, size, q]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / size)),
    [total, size]
  );

  const setContada = (id, val) => {
    const n = Math.max(0, Number(val ?? 0)); // nunca negativo
    setContagens((prev) => ({ ...prev, [id]: n }));
  };

  const getContada = (id, qtdSistema) =>
    contagens[id] !== undefined ? contagens[id] : qtdSistema;

  const pendentes = useMemo(() => {
    // itens que realmente terão ajuste (contada != sistema)
    return rows
      .map((r) => {
        const contada = getContada(r.id, r.quantidade ?? 0);
        const diff = Number(contada) - Number(r.quantidade ?? 0);
        return { ...r, contada, diff };
      })
      .filter((x) => Number(x.diff) !== 0);
  }, [rows, contagens]);

  const aplicarAjustes = async () => {
    if (pendentes.length === 0) {
      alert("Nenhum ajuste a aplicar.");
      return;
    }

    if (!confirm(`Aplicar ${pendentes.length} ajuste(s) de inventário?`)) return;

    try {
      setLoading(true);

      // Aplica um por um (simples e seguro para seu volume)
      for (const item of pendentes) {
        const diff = Number(item.contada) - Number(item.quantidade ?? 0);
        const tipo = diff > 0 ? "Entrada" : "Saida";
        const qtd = Math.abs(diff);

        // 1) registra movimentação
        const { error: movErr } = await supabase.from("movimentacoes").insert([
          {
            tipo,
            produto_id: item.id,
            quantidade: qtd,
            atividade: `Ajuste de inventário (de ${item.quantidade ?? 0} para ${item.contada})`,
          },
        ]);
        if (movErr) throw movErr;

        // 2) atualiza estoque para a contada
        const { error: updErr } = await supabase
          .from("produtos")
          .update({ quantidade: Number(item.contada) })
          .eq("id", item.id);
        if (updErr) throw updErr;
      }

      alert("Ajustes aplicados com sucesso!");
      // Recarrega a página atual para refletir os novos saldos
      const from = (page - 1) * size;
      const to = from + size - 1;
      const { data } = await supabase
        .from("produtos")
        .select("id,codigo,nome,localizacao,quantidade", { count: "exact" })
        .order("id", { ascending: true })
        .range(from, to);
      setRows(data ?? {});
      // limpar as contagens dos ids exibidos (opcional)
      setContagens((prev) => {
        const clone = { ...prev };
        for (const r of rows) delete clone[r.id];
        return clone;
      });
    } catch (e) {
      console.error(e);
      alert("Falha ao aplicar ajustes: " + (e.message || JSON.stringify(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      {/* Barra superior */}
      <div className="flex items-center gap-3">
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Pesquisar por nome ou código..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Por página</span>
          <select
            className="border rounded px-2 py-2"
            value={size}
            onChange={(e) => {
              setPage(1);
              setSize(parseInt(e.target.value, 10));
            }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <button
          onClick={aplicarAjustes}
          disabled={loading || pendentes.length === 0}
          className={`px-4 py-2 rounded text-white ${
            pendentes.length === 0
              ? "bg-gray-400"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          Aplicar ajustes ({pendentes.length})
        </button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg shadow-md mt-3">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr className="bg-gray-200 text-gray-700 text-sm uppercase">
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Produto</th>
              <th className="px-4 py-3 text-left">Localização</th>
              <th className="px-4 py-3 text-center">Sistema</th>
              <th className="px-4 py-3 text-center">Contada</th>
              <th className="px-4 py-3 text-center">Diferença</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : errorMsg ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-red-600">
                  {errorMsg}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : (
              rows.map((p, i) => {
                const contada = getContada(p.id, p.quantidade ?? 0);
                const diff = Number(contada) - Number(p.quantidade ?? 0);
                const badge =
                  diff === 0
                    ? "bg-gray-100 text-gray-700"
                    : diff > 0
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700";

                return (
                  <tr
                    key={p.id}
                    className={`${
                      i % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-blue-50 transition`}
                  >
                    <td className="px-4 py-2 text-sm text-gray-600">{p.id}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {p.codigo ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {p.nome}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {p.localizacao || "—"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                        {p.quantidade ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={contada}
                        onChange={(e) => setContada(p.id, e.target.value)}
                        className="w-24 border rounded px-2 py-1 text-center"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs ${badge}`}>
                        {diff > 0 ? `+${diff}` : diff}
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
          Total: {total} • Página {page} de {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="border rounded px-3 py-1"
            disabled={page === 1}
            onClick={() => setPage(1)}
          >
            « Primeiro
          </button>
          <button
            className="border rounded px-3 py-1"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Anterior
          </button>
          <button
            className="border rounded px-3 py-1"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima ›
          </button>
          <button
            className="border rounded px-3 py-1"
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            Última »
          </button>
        </div>
      </div>
    </div>
  );
}
