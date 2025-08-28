import { useState } from "react";
import Select from "react-select";

export default function MaquinaForm({ onAdd, maquinas = [] }) {
  const [bem, setBem] = useState("");
  const [maquina, setMaquina] = useState(null); // guarda objeto do react-select

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!maquina || !maquina.label.trim()) {
      alert("Informe a identificação da máquina!");
      return;
    }

    const novaMaquina = {
      bem: bem ? Number(bem) : null,
      identificacao: maquina.label.trim(),
    };

    onAdd(novaMaquina);

    // limpa os campos
    setBem("");
    setMaquina(null);
  };

  // opções para o select
  const options = maquinas.map((m) => ({
    value: m.id,
    label: m.identificacao,
  }));

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-4 border rounded bg-white shadow"
    >
      <h2 className="text-lg font-semibold mb-2">Cadastrar Máquina</h2>

      <div className="flex gap-2 items-center">
        <input
          type="number"
          placeholder="Nº patrimonial (opcional)"
          value={bem}
          onChange={(e) => setBem(e.target.value)}
          className="border p-2 w-40"
        />

        <div className="flex-1">
          <Select
            options={options}
            value={maquina}
            onChange={setMaquina}
            placeholder="Digite ou selecione uma máquina..."
            isClearable
            isSearchable
          />
        </div>

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
