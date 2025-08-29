export default function ProdutosTable({ data }) {
  return (
    <div className="overflow-x-auto rounded-lg shadow-md mt-6">
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
          {data.map((p, i) => (
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

              <td className="px-4 py-2 font-medium text-gray-800">{p.nome}</td>
              <td className="px-4 py-2 text-gray-600">
                {p.localizacao || "—"}
              </td>

              {/* Badge quantidade */}
              <td className="px-4 py-2 text-center">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    p.quantidade > 50
                      ? "bg-green-100 text-green-700"
                      : p.quantidade > 10
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {p.quantidade}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
