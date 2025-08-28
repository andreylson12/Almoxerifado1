import { useState } from "react";
import Select from "react-select";

export default function MovForm({ produtos, funcionarios, maquinas, onAdd }) {
  const [tipo, setTipo] = useState("Entrada");
  const [produto, setProduto] = useState(null);
  const [funcionario, setFuncionario] = useState(null);
  const [maquina, setMaquina] = useState(null);
  const [quantidade, setQuantidade] = useState("");
  const [atividade, setAtividade] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!quantidade) {
      alert("Informe a quantidade.");
      return;
    }

    onAdd({
      tipo,
      produtoId: produto ? produto.value : null,
      funcionarioId: funcionario ? funcionario.value : null,
      maquinaId: maquina ? maquina.value : null,
      quantidade: Number(quantidade),
      atividade: atividade?.trim() || null,
    });

    // limpa o form
    setProduto(null);
    setFuncionario(null);
    setMaquina(null);
    setQuantidade("");
    setAtividade("");
    setTipo("Entrada");
  };

  // transforma os dados para o react-select
  const produtoOptions = produtos.map((p) => ({ value: p.id, label: p.nome }));
  const funcionarioOptions = funcionarios.map((f) => ({ value: f.id, label: f.nome }));
  const maquinaOptions = maquinas.map((m) => ({ value: m.id, label: m.identificacao }));

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Tipo */}
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        className="border p-2 w-full"
      >
        <option>Entrada</option>
        <option>Saida</option>
      </select>

      {/* Produto */}
      <Select
        options={produtoOptions}
        value={produto}
        onChange={setProduto}
        placeholder="Selecione um produto..."
        isClearable
      />

      {/* Funcionário */}
      <Select
        options={funcionarioOptions}
        value={funcionario}
        onChange={setFuncionario}
        placeholder="Selecione um funcionário..."
        isClearable
      />

      {/* Máquina */}
      <Select
        options={maquinaOptions}
        value={maquina}
        onChange={setMaquina}
        placeholder="Selecione uma máquina..."
        isClearable
      />

      {/* Quantidade */}
      <input
        type="number"
        placeholder="Quantidade"
        value={quantidade}
        onChange={(e) => setQuantidade(e.target.value)}
        className="border p-2 w-full"
      />

      {/* Atividade */}
      <input
        type="text"
        placeholder="Atividade"
        value={atividade}
        onChange={(e) => setAtividade(e.target.value)}
        className="border p-2 w-full"
      />

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Salvar Movimentação
      </button>
    </form>
  );
}
