import { useState } from "react";

export default function ProdutoForm({ onAdd }) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [search, setSearch] = useState(""); // 🔍 busca interna

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome) return alert("Preencha o nome do produto");

    onAdd({
      codigo,
      nome,
      localizacao,
      quantidade,
    });

    // limpa o form
    setCodigo("");
    setNome("");
    setLocalizacao("");
    setQuantidade(0);
    setSearch("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Campo de busca */}
      <input
        type="text"
        placeholder="Buscar produto ou localização..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border p-2 w-full"
      />

      {/* Código */}
      <input
        type="text"
        placeholder="Código"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        className="border p-2 w-full"
      />

      {/* Nome (filtra conforme digita) */}
      <input
        type="text"
        placeholder="Produto"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="border p-2 w-full"
        list="produtos-sugestoes"
      />
      <datalist id="produtos-sugestoes">
        {nome.toLowerCase().includes(search.toLowerCase()) && (
          <option value={nome} />
        )}
      </datalist>

      {/* Localização (também filtrável) */}
      <input
        type="text"
        placeholder="Localização"
        value={localizacao}
        onChange={(e) => setLocalizacao(e.target.value)}
        className="border p-2 w-full"
        list="local-sugestoes"
      />
      <datalist id="local-sugestoes">
        {localizacao.toLowerCase().includes(search.toLowerCase()) && (
          <option value={localizacao} />
        )}
      </datalist>

      {/* Quantidade */}
      <input
        type="number"
        placeholder="0"
        value={quantidade}
        onChange={(e) => setQuantidade(parseInt(e.target.value))}
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
