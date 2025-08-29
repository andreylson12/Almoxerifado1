import { useState, useEffect } from "react";
import { auth } from "./firebaseConfig";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

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
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [search, setSearch] = useState("");

  // 🔐 Monitora login/logout
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // 🔄 Carrega dados do supabase só se estiver logado
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

  // 🔎 Filtro de produtos
  const produtosFiltrados = produtos.filter((p) =>
    (p.nome || "").toLowerCase().includes(search.toLowerCase())
  );

  // 👉 Se não logado, mostra tela de login
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

  // 👉 Se logado, mostra sistema normal
  return (
    <div className="min-h-screen bg-slate-50 p-6">
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
              onAdd={() => {}}
            />
            <MovTable data={movimentacoes} />
          </>
        )}

        {/* PRODUTOS */}
        {tab === "Produtos" && (
          <>
            <ProdutoForm onAdd={() => {}} />
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
            <MaquinaForm onAdd={() => {}} />
            <MaquinasTable data={maquinas} />
          </>
        )}

        {/* FUNCIONÁRIOS */}
        {tab === "Funcionários" && (
          <>
            <FuncionarioForm onAdd={() => {}} />
            <FuncionariosTable data={funcionarios} />
          </>
        )}
      </div>
    </div>
  );
}
