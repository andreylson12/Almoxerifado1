import { useState, useEffect } from "react";
import { auth } from "./firebaseConfig";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { supabase } from "./supabaseClient";

import Tabs from "./components/Tabs";
import MovForm from "./components/MovForm";
import MovTable from "./components/MovTable";
import ProdutoForm from "./components/ProdutoForm";
import ProdutosTable from "./components/ProdutosTable";
import MaquinaForm from "./components/MaquinaForm";
import MaquinasTable from "./components/MaquinasTable";
import FuncionarioForm from "./components/FuncionarioForm";
import FuncionariosTable from "./components/FuncionariosTable";

export default function App() {
  const [tab, setTab] = useState("Movimentações");
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);

  const [search, setSearch] = useState("");

  // 🔐 Controle de autenticação Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // 🔄 Carrega dados do Supabase quando usuário está logado
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      console.log("🔄 Carregando dados do Supabase...");
      const { data: produtosData } = await supabase.from("produtos").select("*");
      const { data: maquinasData } = await supabase.from("maquinas").select("*");
      const { data: funcionariosData } = await supabase.from("funcionarios").select("*");
      const { data: movsData } = await supabase
        .from("movimentacoes")
        .select(`
          *,
          produtos (nome, localizacao),
          funcionarios (nome),
          maquinas (identificacao)
        `)
        .order("created_at", { ascending: false });

      setProdutos(produtosData || []);
      setMaquinas(maquinasData || []);
      setFuncionarios(funcionariosData || []);
      setMovimentacoes(movsData || []);
      console.log("✅ Dados carregados.");
    };

    fetchData();
  }, [user]);

  // 🔐 Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setErro("");
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
      setErro("Erro ao fazer login: " + error.message);
    }
  };

  // 🔐 Logout
  const handleLogout = async () => {
    await signOut(auth);
  };

  // ➕ Salvar movimentação
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

      // Atualiza estoque
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

          if (!estoqueError) {
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

  // 🔎 Filtro de produtos
  const produtosFiltrados = produtos.filter((p) =>
    (p.nome || "").toLowerCase().includes(search.toLowerCase())
  );

  // 🔐 Se não logado → tela de login
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <form
          onSubmit={handleLogin}
          className="bg-white p-6 rounded-xl shadow-lg w-80 space-y-4"
        >
          <h2 className="text-xl font-semibold text-center">Login</h2>
          {erro && <p className="text-red-500 text-sm">{erro}</p>}
          <input
            type="email"
            placeholder="Digite seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            placeholder="Digite sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  // Sistema principal
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Almoxarifado</h1>
        <div className="flex items-center gap-3">
          <span className="text-gray-600">{user.email}</span>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg"
          >
            Sair
          </button>
        </div>
      </div>

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

                  const { data, error } = await supabase
                    .from("produtos")
                    .insert([produtoCorrigido])
                    .select();

                  if (!error) setProdutos((prev) => [...prev, ...data]);
                } catch (e) {
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
                    bem: m.bem ? Number(m.bem) : null,
                    identificacao: m.identificacao?.trim(),
                  };

                  if (!maquinaCorrigida.identificacao) {
                    alert("Informe a identificação da máquina.");
                    return;
                  }

                  const { data, error } = await supabase
                    .from("maquinas")
                    .insert([maquinaCorrigida])
                    .select();

                  if (!error) setMaquinas((prev) => [...prev, ...data]);
                } catch (e) {
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

                  const { data, error } = await supabase
                    .from("funcionarios")
                    .insert([funcionarioCorrigido])
                    .select();

                  if (!error) setFuncionarios((prev) => [...prev, ...data]);
                } catch (e) {
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
