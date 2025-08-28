import { useState } from "react";

export default function FuncionarioForm({ onAdd, funcionarios = [] }) {
  const [nome, setNome] = useState("");
  const [search, setSearch] = useState(""); // 🔍 busca interna

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert("Informe o nome do funcionário!");
      return;
    }

    onAdd({ nome: nome.trim() }); // id é gerado no banco
    setNome("");
    setSearch("");
  };

  // filtra sugestões de funcionários existentes
  const sugestoes = funcionarios.filter((f) =>
    f.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-4 border rounded bg-white shadow"
    >
      <h2 className="text-lg font-semibold mb-2">Cadastrar Funcionário</h2>

      {/* campo de busca */}
      <input
        type="text"
        placeholder="Buscar funcionário..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border p-2 w-full mb-2"
      />

      <div className="flex gap-2">
        {/* nome com autocomplete */}
        <input
          type="text"
          placeholder="Nome do funcionário"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="border p-2 flex-1"
          list="func-sugestoes"
        />
        <datalist id="func-sugestoes">
          {sugestoes.map((f) => (
            <option key={f.id} value={f.nome} />
          ))}
        </datalist>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
