import { useState } from "react";
import Select from "react-select";

export default function FuncionarioForm({ onAdd, funcionarios = [] }) {
  const [nome, setNome] = useState(null); // armazenar o objeto do react-select

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome || !nome.label.trim()) {
      alert("Informe o nome do funcionário!");
      return;
    }

    onAdd({ nome: nome.label.trim() }); // id é gerado no banco
    setNome(null);
  };

  // opções formatadas para o react-select
  const options = funcionarios.map((f) => ({
    value: f.id,
    label: f.nome,
  }));

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-4 border rounded bg-white shadow"
    >
      <h2 className="text-lg font-semibold mb-2">Cadastrar Funcionário</h2>

      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <Select
            options={options}
            value={nome}
            onChange={setNome}
            placeholder="Digite ou selecione um funcionário..."
            isClearable
            isSearchable
          />
        </div>

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
