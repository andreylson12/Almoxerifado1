export default function MaquinasTable({ data }) {
  return (
    <div className="overflow-x-auto mt-6">
      <table className="min-w-full bg-white border rounded shadow">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="px-4 py-2 border">ID</th>
            <th className="px-4 py-2 border">Bem (Patrimônio)</th>
            <th className="px-4 py-2 border">Identificação</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan="3" className="text-center py-4">
                Nenhuma máquina cadastrada
              </td>
            </tr>
          ) : (
            data.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{m.id}</td>
                <td className="px-4 py-2 border">{m.bem || "—"}</td>
                <td className="px-4 py-2 border">{m.identificacao}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
