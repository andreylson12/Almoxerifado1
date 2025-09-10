import { useMemo, useState } from "react";

export default function DefensivosTable({ data = [] }) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(d =>
      String(d.nome ?? "").toLowerCase().includes(term) ||
      String(d.tipo ?? "").toLowerCase().includes(term)
    );
  }, [data, q]);

  return (
    <>
      <input
        className="border rounded px-3 py-2 w-full mt-4"
        placeholder="Pesquisar por nome ou tipo..."
        value={q}
        onChange={(e)=>setQ(e.target.value)}
      />
      <div className="overflow-x-auto rounded-lg shadow-md mt-3">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr className="bg-gray-200 text-gray-700 text-sm uppercase">
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Unid.</th>
              <th className="px-4 py-3 text-left">Localização</th>
              <th className="px-4 py-3 text-center">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Nenhum defensivo encontrado.
                </td>
              </tr>
            ) : rows.map((d, i) => (
              <tr key={d.id} className={`${i%2===0?"bg-gray-50":"bg-white"} hover:bg-blue-50`}>
                <td className="px-4 py-2 text-sm text-gray-600">{d.id}</td>
                <td className="px-4 py-2 font-medium text-gray-800">{d.nome}</td>
                <td className="px-4 py-2 text-gray-700">{d.tipo}</td>
                <td className="px-4 py-2 text-gray-700">{d.unidade}</td>
                <td className="px-4 py-2 text-gray-700">{d.localizacao || "—"}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    Number(d.quantidade ?? 0) > 50
                      ? "bg-green-100 text-green-700"
                      : Number(d.quantidade ?? 0) > 10
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {d.quantidade ?? 0} {d.unidade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
