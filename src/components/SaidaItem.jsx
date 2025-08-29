import { useState } from "react";
import QrReader from "react-qr-reader";
import { supabase } from "../supabaseClient"; // atenção no caminho!

export default function SaidaItem() {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState("");
  const [loading, setLoading] = useState(false);

  const registrarSaida = async (codigo) => {
    setLoading(true);

    const { data: produto, error: erroProduto } = await supabase
      .from("produtos")
      .select("*")
      .eq("codigo", codigo)
      .single();

    if (erroProduto || !produto) {
      setResultado("❌ Produto não encontrado!");
      setLoading(false);
      return;
    }

    const { error: erroMov } = await supabase
      .from("movimentacoes")
      .insert([
        {
          produto_id: produto.id,
          tipo: "saida",
          quantidade: 1,
          data: new Date(),
        },
      ]);

    if (erroMov) {
      setResultado("❌ Erro ao registrar movimentação!");
      setLoading(false);
      return;
    }

    const { error: erroUpdate } = await supabase
      .from("produtos")
      .update({ quantidade: produto.quantidade - 1 })
      .eq("id", produto.id);

    if (erroUpdate) {
      setResultado("⚠️ Movimentação registrada, mas não atualizou estoque!");
    } else {
      setResultado(`✅ Saída registrada: ${produto.nome}`);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Saída de Produto</h2>

      <QrReader
        delay={300}
        onScan={(data) => {
          if (data) {
            setCodigo(data);
            registrarSaida(data);
          }
        }}
        onError={(err) => console.error(err)}
        style={{ width: "100%" }}
      />

      <p>Ou digite manualmente:</p>
      <input
        type="text"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Código do produto"
        style={{ padding: 8, width: "100%", marginBottom: 10 }}
      />

      <button
        onClick={() => registrarSaida(codigo)}
        disabled={loading}
        style={{
          padding: 10,
          width: "100%",
          background: "#4CAF50",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
      >
        {loading ? "Registrando..." : "Registrar Saída"}
      </button>

      <p>{resultado}</p>
    </div>
  );
}
