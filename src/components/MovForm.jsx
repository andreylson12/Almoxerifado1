import { useState } from "react";

export default function MovForm({ produtos, funcionarios, maquinas, onAdd }) {
  const [tipo, setTipo] = useState("Entrada");
  const [produtoId, setProdutoId] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [atividade, setAtividade] = useState("");

  // Estados para filtros
  const [filtroProduto, setFiltroProduto] = useState("");
  const [filtroFuncionario, setFiltroFuncionario] = useState("");
  const [filtroMaquina, setFiltroMaquina] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!quantidade) {
      alert("Informe a quantidade.");
      return;
    }

    onAdd({
      tipo,
      produtoId: produtoId ? Number(produtoId) : null,
      funcionarioId: funcionarioId ? Number(funcionarioId) : null,
      maquinaId: maquinaId ? Number(maquinaId) : null,
      quantidade: Number(quantidade),
      atividade: atividade?.trim() || null,
    });

    // limpa o form
    setProdutoId("");
    setFuncionarioId("");
    setMaquinaId("");
    setQuantidade("");
    setAtividade("");
    setTipo("Entrada");
    setFiltroProduto("");
    setFiltroFuncionario("");
    setFiltroMaquina("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border p-2 w-full">
        <option>Entrada</option>
        <option>Saida</option>
      </select>

      {/* Produto */}
      <input
        type="text"
        placeholder="Buscar produto..."
        value={filtroProduto}
        onChange={(e) => setFiltroProduto(e.target.value)}
        className="border p-2 w-full"
      />
      <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="border p-2 w-full">
        <option value="">Selecione um produto</option>
        {produtos
          .filter((p) =>
            p.nome.toLowerCase().includes(filtroProduto.toLowerCase())
          )
          .map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
      </select>

      {/* Funcionário */}
      <input
        type="text"
        placeholder="Buscar funcionário..."
        value={filtroFuncionario}
        onChange={(e) => setFiltroFuncionario(e.target.value)}
        className="border p-2 w-full"
      />
      <select value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)} className="border p-2 w-full">
        <option value="">Selecione um funcionário</option>
        {funcionarios
          .filter((f) =>
            f.nome.toLowerCase().includes(filtroFuncionario.toLowerCase())
          )
          .map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
      </select>

      {/* Máquina */}
      <input
        type="text"
        placeholder="Buscar máquina..."
        value={filtroMaquina}
        onChange={(e) => setFiltroMaquina(e.target.value)}
        className="border p-2 w-full"
      />
      <select value={maquinaId} onChange={(e) => setMaquinaId(e.target.value)} className="border p-2 w-full">
        <option value="">Selecione uma máquina</option>
        {maquinas
          .filter((m) =>
            m.identificacao.toLowerCase().includes(filtroMaquina.toLowerCase())
          )
          .map((m) => (
            <option key={m.id} value={m.id}>{m.identificacao}</option>
          ))}
      </select>

      <input
        type="number"
        placeholder="Quantidade"
        value={quantidade}
        onChange={(e) => setQuantidade(e.target.value)}
        className="border p-2 w-full"
      />

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
