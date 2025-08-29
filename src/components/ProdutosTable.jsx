export default function ProdutosTable({ data }) {
  return (
    <table className="w-full border mt-4">
      <thead>
        <tr className="bg-gray-100">
          <th className="border px-2 py-1">ID</th>
          <th className="border px-2 py-1">Imagem</th>
          <th className="border px-2 py-1">Nome</th>
          <th className="border px-2 py-1">Localização</th>
          <th className="border px-2 py-1">Quantidade</th>
        </tr>
      </thead>
      <tbody>
        {data.map((p) => (
          <tr key={p.id}>
            <td className="border px-2 py-1">{p.id}</td>

            {/* Coluna da imagem */}
            <td className="border px-2 py-1 text-center">
              {p.imagem_url ? (
                <img
                  src={p.imagem_url}
                  alt={p.nome}
                  className="w-16 h-16 object-cover mx-auto rounded"
                />
              ) : (
                <span>—</span>
              )}
            </td>

            <td className="border px-2 py-1">{p.nome}</td>
            <td className="border px-2 py-1">{p.localizacao || "—"}</td>
            <td className="border px-2 py-1">{p.quantidade}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
