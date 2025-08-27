import { useState } from "react";

export default function ProdutoForm({ onAdd }) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [quantidade, setQuantidade] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome) return alert("Preencha o nome do produto");

    onAdd({
      codigo,
      nome,
      localizacao,   // ✅ agora vai salvar localização
      quantidade,
    });

    setCodigo("");
    setNome("");
    setLocalizacao("");
    setQuantidade(0);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        placeholder="Código"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        className="border p-2 flex-1"
      />
      <input
        type="text"
        placeholder="Produto"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="border p-2 flex-1"
      />
      <input
        type="text"
        placeholder="Localização"
        value={localizacao}
        onChange={(e) => setLocalizacao(e.target.value)}
        className="border p-2 flex-1"
      />
      <input
        type="number"
        placeholder="0"
        value={quantidade}
        onChange={(e) => setQuantidade(parseInt(e.target.value))}
        className="border p-2 w-20"
      />
      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Adicionar
      </button>
    </form>
  );
}
