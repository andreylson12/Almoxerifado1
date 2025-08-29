import { useState, useEffect } from "react";
import { useZxing } from "react-zxing";
import { supabase } from "../supabaseClient";

export default function SaidaItem() {
  const [result, setResult] = useState("");
  const [produto, setProduto] = useState(null);
  const [funcionarios, setFuncionarios] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [funcionarioId, setFuncionarioId] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [atividade, setAtividade] = useState("");
  const [quantidade, setQuantidade] = useState(1);

  // QRCode scanner
  const { ref } = useZxing({
    onDecodeResult(result) {
      setResult(result.getText());
    },
  });

  // Buscar produto pelo código
  useEffect(() => {
    const fetchProduto = async () => {
      if (!result) return;
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("codigo", result)
        .single();
      if (!error) setProduto(data);
    };
    fetchProduto();
  }, [result]);

  // Buscar funcionários e máquinas
  useEffect(() => {
    const fetchData = async () => {
      const { data: funcs } = await supabase.from("funcionarios").select("*");
      const { data: maqs } = await supabase.from("maquinas").select("*");
      setFuncionarios(funcs || []);
      setMaquinas(maqs || []);
    };
    fetchData();
  }, []);

  const handleRegistrarSaida = async () => {
    if (!produto) {
      alert("Nenhum produto encontrado.");
      return;
    }

    // 1. Atualizar estoque
    await supabase
      .from("produtos")
      .update({ quantidade: produto.quantidade - quantidade })
      .eq("id", produto.id);

    // 2. Registrar movimentação
    await supabase.from("movimentacoes").insert([
      {
        tipo: "Saida",
        produto_id: produto.id,
        quantidade,
        funcionario_id: funcionarioId || null,
        maquina_id: maquinaId || null,
        atividade: atividade || null,
      },
    ]);

    alert("Saída registrada com sucesso!");
    setResult("");
    setProduto(null);
    setFuncionarioId("");
    setMaquinaId("");
    setAtividade("");
    setQuantidade(1);
  };

  return (
    <div>
      <h2>Saída de Produto via QR Code</h2>

      {/* Scanner */}
      <video ref={ref} style={{ width: "300px" }} />

      {/* Produto encontrado */}
      {produto && (
        <div>
          <p><b>Produto:</b> {produto.nome}</p>

          <div>
            <label>Funcionário:</label>
            <select value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)}>
              <option value="">Selecione...</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Máquina:</label>
            <select value={maquinaId} onChange={(e) => setMaquinaId(e.target.value)}>
              <option value="">Selecione...</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Atividade:</label>
            <input
              type="text"
              value={atividade}
              onChange={(e) => setAtividade(e.target.value)}
              placeholder="Descreva a atividade"
            />
          </div>

          <div>
            <label>Quantidade:</label>
            <input
              type="number"
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              min="1"
            />
          </div>

          <button onClick={handleRegistrarSaida}>
            Registrar Saída
          </button>
        </div>
      )}
    </div>
  );
}
