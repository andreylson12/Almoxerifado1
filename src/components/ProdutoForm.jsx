import { useState } from "react";
import Select from "react-select";
import { PlusCircle } from "lucide-react";

export default function ProdutoForm({ onAdd, produtos = [], locais = [] }) {
  const [codigo, setCodigo] = useState("");
  const [produto, setProduto] = useState(null);   // react-select produto
  const [local, setLocal] = useState(null);       // react-select local
  const [quantidade, setQuantidade] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!produto || !produto.label?.trim()) {
      alert("Informe o nome do produto");
      return;
    }

    if (Number(quantidade) <= 0) {
      alert("Informe uma quantidade válida");
      return;
    }

    onAdd({
      codigo,
      nome: produto.label.trim(),
      localizacao: local ? local.label.trim() : "",
      quantidade: Number(quantidade),
    });

    // limpa o formulário
    setCodigo("");
    setProduto(null);
    setLocal(null);
    setQuantidade(0);
  };

  const produtoOptions = produtos.map((p) => ({
    value: p.id,
    label: p.nome,
  }));

  const localOptions = locais.map((l, i) => ({
    value: i,
    label: l,
  }));

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
      {/* Título */}
      <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2 mb-4">
        <PlusCircle className="h-5 w-5 text-blue-600" />
        Cadastrar Produto
      </h2>

      {/* Grid dos inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Código */}
        <input
          type="text"
          placeholder="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />

        {/* Produto */}
        <Select
          options={produtoOptions}
          value={produto}
          onChange={setProduto}
          placeholder="Digite ou selecione um produto..."
          isClearable
          isSearchable
          className="text-sm"
        />

        {/* Localização */}
        <Select
          options={localOptions}
          value={local}
          onChange={setLocal}
          placeholder="Digite ou selecione a localização..."
          isClearable
          isSearchable
          className="text-sm"
        />

        {/* Quantidade */}
        <input
          type="number"
          placeholder="Digite a quantidade"
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value) || 0)}
          className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
      </div>

      {/* Botão */}
      <div className="mt-5">
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition"
        >
          <PlusCircle className="h-5 w-5" />
          Adicionar Produto
        </button>
      </div>
    </form>
  );
}
