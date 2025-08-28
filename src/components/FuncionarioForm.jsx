import { useState } from "react";

export default function FuncionarioForm({ onAdd }) {
  const [nome, setNome] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert("Informe o nome do funcionário!");
      return;
    }
    onAdd({ nome: nome.trim() }); // id é gerado no banco
    setNome("");
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-4 border rounded bg-white shadow">
      <h2 className="text-lg font-semibold mb-2">Cadastrar Funcionário</h2>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nome do funcionário"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="border p-2 flex-1"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Salvar
        </button>
      </div>
    </form>
  );
}
