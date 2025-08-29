export default function ProdutosTable({ data }) {
  return (
    <div className="bg-white shadow-lg rounded-2xl p-6 mt-6">
      <h2 className="text-xl font-bold text-gray-700 mb-4">📦 Produtos</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 text-gray-700">
            <th className="border-b px-3 py-2 text-left">ID</th>
            <th className="border-b px-3 py-2 text-left">Imagem</th>
            <th className="border-b px-3 py-2 text-left">Nome</th>
            <th className="border-b px-3 py-2 text-left">Localização</th>
            <th className="border-b px-3 py-2 text-left">Quantidade</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr
              key={p.id}
              className="hover:bg-gray-50 transition duration-150 ease-in-out"
            >
              <td className="border-b px-3 py-2">{p.id}</td>
              <td className="border-b px-3 py-2">
                {p.imagem_url ? (
                  <img
                    src={p.imagem_url}
                    alt={p.nome}
                    className="w-12 h-12 object-contain rounded-md border"
                  />
                ) : (
                  <span className="text-gray-400 italic">Sem imagem</span>
                )}
              </td>
              <td className="border-b px-3 py-2 font-medium text-gray-700">{p.nome}</td>
              <td className="border-b px-3 py-2">{p.localizacao || "—"}</td>
              <td className="border-b px-3 py-2 text-center">{p.quantidade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
