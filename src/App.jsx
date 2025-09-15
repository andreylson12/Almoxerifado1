import { useState, useEffect } from "react";
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
import Inventario from "./components/Inventario";
import Defensivos from "./components/Defensivos";
import Colheita from "./components/Colheita"; // ✅

const PROD_PAGE_SIZE = 50;
const TABS = [
  "Movimentações",
  "Produtos",
  "Defensivos",
  "Inventário",
  "Máquinas",
  "Funcionários",
  "Colheita", // ✅ vai aparecer
];

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(TABS[0]);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);

  const [search, setSearch] = useState("");
  const [prodPage, setProdPage] = useState(1);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodLoading, setProdLoading] = useState(false);

  // auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // produtos paginados
  const fetchProdutos = async (page = 1, term = "") => {
    setProdLoading(true);
    const from = (page - 1) * PROD_PAGE_SIZE;
    const to = from + PROD_PAGE_SIZE - 1;

    let query = supabase
      .from("produtos")
      .select("*", { count: "exact" })
      .order("id", { ascending: true })
      .range(from, to);

    if (term && term.trim()) {
      query = supabase
        .from("produtos")
        .select("*", { count: "exact" })
        .ilike("nome", `%${term.trim()}%`)
        .order("id", { ascending: true })
        .range(from, to);
    }

    const { data, error, count } = await query;
    if (!error) {
      setProdutos(data || []);
      setProdTotal(count || 0);
      setProdPage(page);
    }
    setProdLoading(false);
  };

  // demais dados
  useEffect(() => {
    if (!user) return;
    const fetchOthers = async () => {
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

      setMaquinas(maquinasData || []);
      setFuncionarios(funcionariosData || []);
      setMovimentacoes(movsData || []);
    };
    fetchProdutos(1, search);
    fetchOthers();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchProdutos(1, search);
  }, [search, user]);

  // login/logout
  const handleLogin = async (e) => {
    e.preventDefault();
    setErro("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) setErro("Erro ao fazer login: " + error.message);
    else setUser(data.user);
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded-xl shadow-lg w-80 space-y-4">
          <h2 className="text-xl font-semibold text-center">Login</h2>
          {erro && <p className="text-red-500 text-sm">{erro}</p>}
          <input type="email" placeholder="Digite seu email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          <input type="password" placeholder="Digite sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg">Entrar</button>
        </form>
      </div>
    );
  }

  const prodLastPage = Math.max(1, Math.ceil(prodTotal / PROD_PAGE_SIZE));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo-fazenda.png"
            alt="Logo da fazenda"
            className="h-10 w-10 rounded-full object-cover ring-1 ring-black/5"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <h1 className="text-2xl font-bold">Fazenda Irmão Coragem</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-600">{user.email}</span>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg">Sair</button>
        </div>
      </div>

      <Tabs tabs={TABS} current={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === "Movimentações" && (
          <>
            <MovForm
              produtos={produtos}
              funcionarios={/* passe seus dados */ []}
              maquinas={/* passe seus dados */ []}
              onAdd={() => {}}
            />
            <MovTable data={movimentacoes} onDelete={() => {}} />
          </>
        )}

        {tab === "Produtos" && (
          <>
            <ProdutoForm onAdd={async () => {}} />
            <input
              type="text"
              placeholder="Pesquisar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border p-2 mt-4 w-full"
            />
            {prodLoading ? <div className="p-4">Carregando produtos…</div> : <ProdutosTable data={produtos} />}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button onClick={() => fetchProdutos(1, search)} disabled={prodPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">Primeiro</button>
              <button onClick={() => fetchProdutos(prodPage - 1, search)} disabled={prodPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">Anterior</button>
              <span className="px-2">Total: {prodTotal} • Página {prodPage} de {prodLastPage}</span>
              <button onClick={() => fetchProdutos(prodPage + 1, search)} disabled={prodPage >= prodLastPage} className="px-3 py-1 border rounded disabled:opacity-50">Próxima</button>
              <button onClick={() => fetchProdutos(prodLastPage, search)} disabled={prodPage >= prodLastPage} className="px-3 py-1 border rounded disabled:opacity-50">Última</button>
            </div>
          </>
        )}

        {tab === "Defensivos" && <Defensivos />}
        {tab === "Inventário" && <Inventario pageSize={50} />}
        {tab === "Máquinas" && (
          <>
            <MaquinaForm onAdd={async () => {}} />
            <MaquinasTable data={[]} />
          </>
        )}
        {tab === "Funcionários" && (
          <>
            <FuncionarioForm onAdd={async () => {}} />
            <FuncionariosTable data={[]} />
          </>
        )}
        {tab === "Colheita" && <Colheita />}{/* ✅ */}
      </div>
    </div>
  );
}
