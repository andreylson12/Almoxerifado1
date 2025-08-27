import { useState, useEffect } from "react";
import Tabs from "./components/Tabs";
import MovForm from "./components/MovForm";
import MovTable from "./components/MovTable";
import ProdutoForm from "./components/ProdutoForm";
import ProdutosTable from "./components/ProdutosTable";
import MaquinaForm from "./components/MaquinaForm";
import MaquinasTable from "./components/MaquinasTable";
import FuncionarioForm from "./components/FuncionarioForm";
import FuncionariosTable from "./components/FuncionariosTable";
import { supabase } from "./supabaseClient";

export default function App() {
  const [tab, setTab] = useState("Movimentações");

  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);

  const [search, setSearch] = useState("");

  // Carrega listas
  useEffect(() => {
    const fetchData = async () => {
      console.log("🔄 Carregando dados do Supabase...");
      const { data: produtosData, error: produtosErr } = await supabase.from("produtos").select("*");
      const { data: maquinasData, error: maquinasErr } = await supabase.from("maquinas").select("*");
      const { data: funcionariosData, error: funcErr } = await supabase.from("funcionarios").select("*");
      const { data: movsData, error: movsErr } = await supabase
        .from("movimentacoes")
        .select(`
          *,
          produtos (nome, localizacao),
          funcionarios (nome),
          maquinas (identificacao)
        `)
        .order("created_at", { ascending: false });

      if (produtosErr) console.error("Erro ao buscar produtos:", produtosErr);
      if (maquinasErr) console.error("Erro ao buscar máquinas:", maquinasErr);
      if (funcErr) console.error("Erro ao buscar funcionários:", funcErr);
      if (movsErr) console.error("Erro ao buscar movimentações:", movsErr);

      setProdutos(produtosData || []);
      setMaquinas(maquinasData || []);
      setFuncionarios(funcionariosData || []);
      setMovimentacoes(movsData || []);
      console.log("✅ Dados carregados.");
    };
    fetchData();
  }, []);

  // Salvar movimentação
  const handleMovimentacao = async (mov) => {
    try {
      const prodId = mov.produtoId ?? null;
      const funcId = mov.funcionarioId ?? null;
      const maqId = mov.maquinaId ?? null;

      if (mov.tipo === "Saida" && prodId) {
        const produtoAtual = produtos.find((p) => p.id === prodId);
        if (produtoAtual && Number(produtoAtual.quantidade ?? 0) < Number(mov.quantidade ?? 0)) {
          alert("Estoque insuficiente para essa saída.");
          return;
        }
      }

      const payload = {
        tipo: mov.tipo,
        produto_id: prodId,
        funcionario_id: funcId,
        maquina_id: maqId,
        quantidade: Number(mov.quantidade ?? 0),
        atividade: mov.atividade ?? null,
      };

      console.log("📝 Inserindo movimentação:", payload);

      const { data, error } = await supabase
        .from("movimentacoes")
        .insert([payload])
        .select(`
          *,
          produtos (nome, localizacao),
          funcionarios (nome),
          maquinas (identificacao)
        `);

      if (error) {
        console.error("❌ Erro ao salvar movimentação:", error);
        alert("Erro ao salvar movimentação: " + (error.message || JSON.stringify(error)));
        return;
      }

      console.log("✅ Movimentação inserida:", data);

      // Atualiza estoque local e no banco
      if (payload.produto_id) {
        const produto = produtos.find((p) => p.id === payload.produto_id);
        if (produto) {
          const novoEstoque =
            payload.tipo === "Entrada"
              ? Number(produto.quantidade ?? 0) + payload.quantidade
              : Number(produto.quantidade ?? 0) - payload.quantidade;

          const { error: estoqueError } = await supabase
            .from("produtos")
            .update({ quantidade: novoEstoque })
            .eq("id", payload.produto_id);

          if (estoqueError) {
            console.error("⚠️ Erro ao atualizar estoque:", estoqueError);
          } else {
            setProdutos((prev) =>
              prev.map((p) => (p.id === payload.produto_id ? { ...p, quantidade: novoEstoque } : p))
            );
          }
        }
      }

      setMovimentacoes((prev) => [data[0], ...prev]);
    } catch (e) {
      console.error("‼️ Exceção ao salvar movimentação:", e);
      alert("Falha ao salvar movimentação: " + e.message);
    }
  };

  const produtosFiltrados = produtos.filter((p) =>
    (p.nome || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <h1 className="text-3xl font-bold mb-6">Almoxarifado</h1>

      <Tabs
        tabs={["Movimentações", "Produtos", "Máquinas", "Funcionários"]}
        current={tab}
        onChange={setTab}
      />

      <div className="mt-6">
        {/* MOVIMENTAÇÕES */}
        {tab === "Movimentações" && (
          <>
            <MovForm
              produtos={produtos}
              funcionarios={funcionarios}
              maquinas={maquinas}
              onAdd={handleMovimentacao}
            />
            <MovTable data={movimentacoes} />
          </>
        )}

        {/* PRODUTOS */}
        {tab === "Produtos" && (
          <>
            <ProdutoForm
              onAdd={async (p) => {
                try {
                  const produtoCorrigido = {
                    codigo: p.codigo?.toString().trim() || null,
                    nome: p.nome?.trim(),
                    localizacao: p.localizacao?.trim() || null,
                    quantidade: Number(p.quantidade ?? 0),
                  };

                  if (!produtoCorrigido.nome) {
                    alert("Informe o nome do produto.");
                    return;
                  }

                  console.log("📝 Inserindo produto:", produtoCorrigido);
                  const { data, error } = await supabase
                    .from("produtos")
                    .insert([produtoCorrigido])
                    .select();

                  if (error) {
                    console.error("❌ Erro ao salvar produto:", error);
                    alert("Erro ao salvar produto: " + (error.message || JSON.stringify(error)));
                    return;
                  }

                  console.log("✅ Produto inserido:", data);
                  setProdutos((prev) => [...prev, ...data]);
                } catch (e) {
                  console.error("‼️ Exceção ao salvar produto:", e);
                  alert("Falha ao salvar produto: " + e.message);
                }
              }}
            />
            <input
              type="text"
              placeholder="Pesquisar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border p-2 mt-4 w-full"
            />
            <ProdutosTable data={produtosFiltrados} />
          </>
        )}

        {/* MÁQUINAS */}
        {tab === "Máquinas" && (
          <>
            <MaquinaForm
              onAdd={async (m) => {
                try {
                  const maquinaCorrigida = {
                    bem: m.bem ? Number(m.bem) : null, // número ou null
                    identificacao: m.identificacao?.trim(),
                  };

                  if (!maquinaCorrigida.identificacao) {
                    alert("Informe a identificação da máquina.");
                    return;
                  }

                  console.log("📝 Inserindo máquina:", maquinaCorrigida);
                  const { data, error } = await supabase
                    .from("maquinas")
                    .insert([maquinaCorrigida])
                    .select();

                  if (error) {
                    console.error("❌ Erro ao salvar máquina:", error);
                    alert("Erro ao salvar máquina: " + (error.message || JSON.stringify(error)));
                    return;
                  }

                  console.log("✅ Máquina inserida:", data);
                  setMaquinas((prev) => [...prev, ...data]);
                } catch (e) {
                  console.error("‼️ Exceção ao salvar máquina:", e);
                  alert("Falha ao salvar máquina: " + e.message);
                }
              }}
            />
            <MaquinasTable data={maquinas} />
          </>
        )}

        {/* FUNCIONÁRIOS */}
        {tab === "Funcionários" && (
          <>
            <FuncionarioForm
              onAdd={async (f) => {
                try {
                  const funcionarioCorrigido = {
                    nome: f.nome?.trim(),
                    funcao: f.funcao?.trim() || null,
                  };

                  if (!funcionarioCorrigido.nome) {
                    alert("Informe o nome do funcionário.");
                    return;
                  }

                  console.log("📝 Inserindo funcionário:", funcionarioCorrigido);
                  const { data, error } = await supabase
                    .from("funcionarios")
                    .insert([funcionarioCorrigido])
                    .select();

                  if (error) {
                    console.error("❌ Erro ao salvar funcionário:", error);
                    alert("Erro ao salvar funcionário: " + (error.message || JSON.stringify(error)));
                    return;
                  }

                  console.log("✅ Funcionário inserido:", data);
                  setFuncionarios((prev) => [...prev, ...data]);
                } catch (e) {
                  console.error("‼️ Exceção ao salvar funcionário:", e);
                  alert("Falha ao salvar funcionário: " + e.message);
                }
              }}
            />
            <FuncionariosTable data={funcionarios} />
          </>
        )}
      </div>
    </div>
  );
}
