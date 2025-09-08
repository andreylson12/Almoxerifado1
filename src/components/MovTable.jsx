export default function MovTable({ data, onDelete }) {
  const hasActions = typeof onDelete === "function";

  return (
    <table className="w-full mt-4 border-collapse bg-white shadow rounded">
      <thead>
        <tr className="bg-slate-100">
          <th className="p-2 border">Data</th>
          <th className="p-2 border">Tipo</th>
          <th className="p-2 border">Produto</th>
          <th className="p-2 border">Quantidade</th>
          <th className="p-2 border">Funcionário</th>
          <th className="p-2 border">Máquina</th>
          <th className="p-2 border">Atividade</th>
          {hasActions && <th className="p-2 border">Ações</th>}
        </tr>
      </thead>
      <tbody>
        {data.map((mov) => (
          <tr key={mov.id}>
            <td className="p-2 border">
              {new Date(mov.created_at).toLocaleString()}
            </td>
            <td
              className={`p-2 border font-bold ${
                mov.tipo === "Entrada" ? "text-green-600" : "text-red-600"
              }`}
            >
              {mov.tipo}
            </td>
            <td className="p-2 border">{mov.produtos?.nome || "—"}</td>
            <td className="p-2 border">{mov.quantidade}</td>
            <td className="p-2 border">{mov.funcionarios?.nome || "—"}</td>
            <td className="p-2 border">{mov.maquinas?.identificacao || "—"}</td>
            <td className="p-2 border">{mov.atividade}</td>

            {hasActions && (
              <td className="p-2 border text-center">
                <button
                  type="button"
                  onClick={() => onDelete(mov)}
                  className="px-3 py-1 rounded border text-red-600 hover:text-red-800 hover:bg-red-50 transition"
                  title="Excluir movimentação"
                >
                  Excluir
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
