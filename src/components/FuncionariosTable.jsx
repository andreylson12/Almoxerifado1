export default function FuncionariosTable({ data }) {
  const list = Array.isArray(data) ? data : [];

  return (
    <div className="bg-white p-4 rounded shadow overflow-auto">
      <h3 className="text-base font-semibold mb-3">Funcionários ({list.length})</h3>
      {list.length === 0 ? (
        <div className="text-slate-500 text-sm">Sem funcionários ainda.</div>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-2 text-left">Matrícula/ID</th>
              <th className="p-2 text-left">Nome</th>
            </tr>
          </thead>
          <tbody>
            {list.map((f, i) => (
              <tr key={f.id ?? `${f.nome}-${i}`} className="border-b last:border-0">
                <td className="p-2">{f.matricula || f.id || "—"}</td>
                <td className="p-2">{f.nome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
