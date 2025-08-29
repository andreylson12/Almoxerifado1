import { useState } from "react";
import { supabase } from "../supabaseClient";
import QrScanner from "react-qr-scanner";

export default function SaidaItem() {
  const [codigoProduto, setCodigoProduto] = useState("");
  const [funcionario, setFuncionario] = useState("");
  const [maquina, setMaquina] = useState("");
  const [atividade, setAtividade] = useState("");
  const [quantidade, setQuantidade] = useState(1);

  const handleScan = (data) => {
    if (data) {
      setCodigoProduto(data.text); // QRCode → preenche o código
    }
  };

  const handleError = (err) => {
    console.error(err);
  };

  const registrarSaida = async () => {
    if (!codigoProduto) {
      alert("Informe ou escaneie o código do produto!");
      return;
    }

    const { error } = await supabase.from("movimentacoes").insert([
      {
        tipo: "Saida",
        produto: codigoProduto,
        quantidade,
        funcionario,
        maquina,
        atividade,
        data: new Date(),
      },
    ]);

    if (error) {
      console.error(error);
      alert("Erro ao registrar saída!");
    } else {
      alert("Saída registrada com sucesso!");
      setCodigoProduto("");
      setFuncionario("");
      setMaquina("");
      setAtividade("");
      setQuantidade(1);
    }
  };

  return (
    <div>
      <h2>Saída de Produto via QR Code</h2>

      {/* Scanner de QR Code */}
      <div style={{ width: 300, height: 300, marginBottom: 20 }}>
        <QrScanner
          delay={300}
          style={{ width: "100%" }}
          onError={handleError}
          onScan={handleScan}
        />
      </div>

      {/* Formulário completo */}
      <div>
        <label>Código do Produto</label>
        <input
          type="text"
          value={codigoProduto}
          onChange={(e) => setCodigoProduto(e.target.value)}
          placeholder="Digite ou escaneie o código"
        />

        <label>Funcionário</label>
        <input
          type="text"
          value={funcionario}
          onChange={(e) => setFuncionario(e.target.value)}
          placeholder="Nome do funcionário"
        />

        <label>Máquina</label>
        <input
          type="text"
          value={maquina}
          onChange={(e) => setMaquina(e.target.value)}
          placeholder="Máquina vinculada"
        />

        <label>Atividade</label>
        <input
          type="text"
          value={atividade}
          onChange={(e) => setAtividade(e.target.value)}
          placeholder="Atividade vinculada"
        />

        <label>Quantidade</label>
        <input
          type="number"
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
          min="1"
        />

        <button onClick={registrarSaida} style={{ marginTop: 10 }}>
          Registrar Saída
        </button>
      </div>
    </div>
  );
}
