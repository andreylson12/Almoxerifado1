import { useState } from "react";
import Select from "react-select";

export default function ProdutoForm({ onAdd, produtos = [], locais = [] }) {
  const [codigo, setCodigo] = useState("");
  const [produto, setProduto] = useState(null); // react-select produto
  const [local, setLocal] = useState(null);     // react-select local
  const [quantidade, setQuantidade] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!produto || !produto.label.trim()) {
      alert("Informe o nome do produto");
      return;
    }

    onAdd({
      codigo,
      nome: produto.label.trim(),
      localizacao: local ? local.label.trim() : "",
      quantidade,
    });

    // limpa o form
    setCodigo("");
    setProduto(null);
    setLocal(null);
    setQuantidade(0);
  };

  // opções vindas do banco/lista
  const produtoOptions = produtos.map((p) => ({
    value: p.id,
    label: p.nome,
  }));

  const localOptions = locais.map((l, i) => ({
    value: i,
    label: l,
  }));

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 p-4 border rounded bg-white shadow"
    >
      <h2 className="text-lg font-semibold">Cadastrar Produto</h2>

      {/* Código */}
      <input
        type="text"
        placeholder="Código"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        className="border p-2 w-full"
      />

      {/* Produto */}
      <Select
        options={produtoOptions}
        value={produto}
        onChange={setProduto}
        placeholder="Digite ou selecione um produto..."
        isClearable
        isSearchable
      />

      {/* Localização */}
      <Select
        options={localOptions}
        value={local}
        onChange={setLocal}
        placeholder="Digite ou selecione a localização..."
        isClearable
        isSearchable
      />

      {/* Quantidade */}
      <input
        type="number"
        placeholder="0"
        value={quantidade}
        onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
        className="border p-2 w-full"
      />

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        Adicionar Produto
      </button>
    </form>
  );
}
