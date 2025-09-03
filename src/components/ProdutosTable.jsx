import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient"; // caminho partindo de /componentes

export default function ProdutosTable({
  data,                       // se vier, paginação local
  tableName = "produtos",     // troque se sua tabela tiver outro nome
  initialPageSize = 50,
}) {
  const usingServer = !Array.isArray(data);    // sem data => busca no Supabase
  const [rows, setRows] = useState(Array.isArray(data) ? data : []);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initialPageSize);
  const [q, setQ] = useState("");
  const [total, setTotal] = useState(Array.isArray(data) ? data.length : 0);
  const [errorMsg, setErrorMsg] = useState("");

  // ======== BUSCA NO SUPABASE (modo servidor) ========
  useEffect(() => {
    if (!usingServer) return;

    const fetchPage = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const from = (page - 1) * size;
        const to = from + size - 1;

        let query = supabase
          .from(tableName)
          .select("id, codigo, nome, localizacao, quantidade, imagem_url", {
            count: "exact",
          })
          .order("id", { ascending: true }) // ordenação estável
          .range(from, to);

        if (q.trim()) {
          // busca por nome OU código (ajuste os campos se necessário)
          query = query.or(
            `nome.ilike.%${q.trim()}%,codigo.ilike.%${q.trim()}%`
          );
        }

        const { data: pageRows, count, error } = await query;

        if (error) throw error;
        setRows(pageRows ?? []);
        setTotal(count ?? 0);
      } catch (err) {
        console.error(err);
        setErrorMsg("Não foi possível carregar os produtos.");
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [usingServer, tableName, page, size, q]);

  // ======== PAGINAÇÃO LOCAL (quando data é passado) ========
  const filteredLocal = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const term = q.trim().toLowerCase();
    const base = term
      ? data.filter(
          (p) =>
            String(p.nome ?? "").toLowerCase().includes(term) ||
            String(p.codigo ?? "").toLowerCase().includes(term)
        )
      : data;
    return base;
  }, [data, q]);

  useEffect(() => {
    if (usingServer) return;
    setTotal(filteredLocal.length);
    const from = (page - 1) * size;
    const to = from + size;
    setRows(filteredLocal.slice(from, to));
  }, [usingServer, filteredLocal, page, size]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / size)),
    [total, size]
  );

  return (
    <>
      {/* Busca */}
      <div className="flex items-center justify-between gap-3 mt-4">
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
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg shadow-md mt-3">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr className="bg-gray-200 text-gray-700 text-sm uppercase">
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-center">Imagem</th>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Localização</th>
              <th className="px-4 py-3 text-center">Quantidade</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : errorMsg ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-red-600">
                  {errorMsg}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : (
              rows.map((p, i) => (
                <tr
                  key={p.id}
                  className={`${
                    i % 2 === 0 ? "bg-gray-50" : "bg-white"
                  } hover:bg-blue-50 transition`}
                >
                  <td className="px-4 py-2 text-sm text-gray-600">{p.id}</td>

                  {/* Imagem */}
                  <td className="px-4 py-2 text-center">
                    {p.imagem_url ? (
                      <img
                        src={p.imagem_url}
                        alt={p.nome}
                        className="w-14 h-14 object-cover rounded-lg shadow-sm mx-auto"
                      />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-2 font-medium text-gray-800">
                    {p.nome}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {p.localizacao || "—"}
                  </td>

                  {/* Badge quantidade */}
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        (p.quantidade ?? 0) > 50
                          ? "bg-green-100 text-green-700"
                          : (p.quantidade ?? 0) > 10
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {p.quantidade ?? 0}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Barra de paginação */}
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
    </>
  );
}
