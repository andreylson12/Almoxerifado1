import { useState } from "react";

export default function MaquinaForm({ onAdd }) {
  const [bem, setBem] = useState("");
  const [identificacao, setIdentificacao] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!identificacao) {
      alert("Informe a identificação da máquina!");
      return;
    }

    const novaMaquina = {
      bem: bem ? Number(bem) : null, // garante número ou null
      identificacao: identificacao.trim(),
    };

    onAdd(novaMaquina);

    // limpa os campos
    setBem("");
    setIdentificacao("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-4 border rounded bg-white shadow"
    >
      <h2 className="text-lg font-semibold mb-2">Cadastrar Máquina</h2>

      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Nº patrimonial (opcional)"
          value={bem}
          onChange={(e) => setBem(e.target.value)}
          className="border p-2 flex-1"
        />
        <input
          type="text"
          placeholder="Identificação"
          value={identificacao}
          onChange={(e) => setIdentificacao(e.target.value)}
          className="border p-2 flex-1"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Salvar máquina
        </button>
      </div>
    </form>
  );
}
