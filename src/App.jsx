// src/App.jsx
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

import Tabs from "./components/Tabs";         // usado só no mobile (lg:hidden)
import Sidebar from "./components/Sidebar";

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
import Colheita from "./components/Colheita";
import Plantios from "./components/Plantios";
import Dashboard from "./components/Dashboard";

// 🔵 Paginação produtos
const PROD_PAGE_SIZE = 50;

export default function App() {
  // Auth / UI
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("Painel"); // deixe Painel como padrão
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  // Dados
  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);

  // Busca/paginação produtos
  const [search, setSearch] = useState("");
  const [prodPage, setProdPage] = useState(1);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodLoading, setProdLoading] = useState(false);

  // 🔐 Sessão / listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // 🔎 Produtos (paginado)
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
    if (error) {
      console.error("Erro ao carregar produtos:", error);
    } else {
      setProdutos(data || []);
      setProdTotal(count || 0);
      setProdPage(page);
    }
    setProdLoading(false);
  };

  // 🔁 Máquinas / Funcionários / Movimentações
  const fetchOthers = async () => {
    try {
      const [maq, func, mov] = await Promise.all([
        supabase.from("maquinas").select("*").order("id", { ascending: true }),
        supabase.from("funcionarios").select("*").order("id", { ascending: true }),
        supabase
          .from("movimentacoes")
          .select(
            `
            *,
            produtos (nome, localizacao),
            funcionarios (nome),
            maquinas (identificacao)
          `
          )
          .order("created_at", { ascending: false }),
      ]);

      if (maq.error) {
        console.error("Erro ao carregar máquinas:", maq.error);
        alert("Erro ao carregar máquinas: " + maq.error.message);
      }
      if (func.error) {
        console.error("Erro ao carregar funcionários:", func.error);
        alert("Erro ao carregar funcionários: " + func.error.message);
      }
      if (mov.error) {
        console.error("Erro ao carregar movimentações:", mov.error);
        alert("Erro ao carregar movimentações: " + mov.error.message);
      }

      setMaquinas(maq.data || []);
      setFuncionarios(func.data || []);
      setMovimentacoes(mov.data || []);
    } catch (e) {
      console.error("Falha geral ao carregar dados:", e);
      alert("Falha geral ao carregar dados. Veja o console para detalhes.");
    }
  };

  // 🔄 Carrega dados quando logado
  useEffect(() => {
    if (!user) return;
    fetchProdutos(1, search);
    fetchOthers();
  }, [user]);

  // 🔎 Busca de produtos
  useEffect(() => {
    if (!user) return;
    fetchProdutos(1, search);
  }, [search, user]);

  // 🔐 Login/Logout
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

  // ➕ Movimentação
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

      const { data, error } = await supabase
        .from("movimentacoes")
        .insert([payload])
        .select(
          `
          *,
          produtos (nome, localizacao),
          funcionarios (nome),
          maquinas (identificacao)
        `
        );
      if (error) {
        console.error("❌ Erro ao salvar movimentação:", error);
        alert("Erro ao salvar movimentação: " + (error.message || JSON.stringify(error)));
        return;
      }

      // Atualiza estoque local
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
          if (!estoqueError) fetchProdutos(prodPage, search);
        }
      }

      setMovimentacoes((prev) => [data[0], ...prev]);
    } catch (e) {
      console.error("‼️ Exceção ao salvar movimentação:", e);
      alert("Falha ao salvar movimentação: " + e.message);
    }
  };

  // 🗑️ Excluir movimentação (reverte estoque)
  const handleExcluirMovimentacao = async (mov) => {
    try {
      if (!mov?.id) return alert("Movimentação inválida.");
      const ok = window.confirm("Excluir esta movimentação? O estoque será ajustado automaticamente.");
      if (!ok) return;

      let movimento = mov;
      if (movimento.produto_id === undefined || movimento.quantidade === undefined || movimento.tipo === undefined) {
        const { data: row, error } = await supabase
          .from("movimentacoes")
          .select("id, tipo, produto_id, quantidade")
          .eq("id", mov.id)
          .single();
        if (error) throw error;
        movimento = row;
      }

      const { produto_id, tipo, quantidade } = movimento;

      if (produto_id) {
        const { data: prod, error: prodErr } = await supabase
          .from("produtos")
          .select("id, quantidade")
          .eq("id", produto_id)
          .single();
        if (prodErr) throw prodErr;

        const atual = Number(prod?.quantidade ?? 0);
        const delta = tipo === "Entrada" ? -Number(quantidade) : Number(quantidade);
        const novo = atual + delta;
        if (novo < 0) return alert("A exclusão resultaria em estoque negativo. Operação cancelada.");

        const { error: upErr } = await supabase.from("produtos").update({ quantidade: novo }).eq("id", produto_id);
        if (upErr) throw upErr;
      }

      const { error: delErr } = await supabase.from("movimentacoes").delete().eq("id", mov.id);
      if (delErr) throw delErr;

      setMovimentacoes((prev) => prev.filter((m) => m.id !== mov.id));
      fetchProdutos(prodPage, search);
      alert("Movimentação excluída com sucesso.");
    } catch (e) {
      console.error("Erro ao excluir movimentação:", e);
      alert("Falha ao excluir movimentação: " + (e.message || e.toString()));
    }
  };

  // ✅ Derivados simples
  const estoqueTotal = produtos.reduce((s, p) => s + Number(p.quantidade || 0), 0);
  const ultimasMovs = (movimentacoes ?? []).slice(0, 8);

  // 🔐 Tela de login (PROFISSIONAL)
  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-600 via-lime-600 to-green-700">
        {/* imagem opcional (public/login-bg.jpg) */}
        <img
          src="/login-bg.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        {/* shapes decorativas */}
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-black/10 blur-2xl" />

        <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-white/90 backdrop-blur shadow-xl ring-1 ring-black/5">
            <div className="p-8">
              <div className="mb-6 flex items-center gap-3">
                <img
                  src="/logo-fazenda.png"
                  className="h-10 w-10 rounded-full ring-1 ring-black/5"
                  alt="Logo"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <div className="text-xl font-semibold">Fazenda Irmão coragem</div>
              </div>

              <h2 className="mb-1 text-2xl font-bold">Bem-vindo</h2>
              <p className="mb-6 text-sm text-slate-600">Faça login para acessar o sistema.</p>

              {erro && (
                <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erro}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="password"
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-700"
                >
                  Entrar
                </button>
              </form>
            </div>
            <div className="rounded-b-2xl bg-slate-50/70 px-8 py-3 text-center text-xs text-slate-500">
              © {new Date().getFullYear()} Fazenda Irmão coragem
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🖥️ Layout com Sidebar
  const prodLastPage = Math.max(1, Math.ceil(prodTotal / PROD_PAGE_SIZE));

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-lime-50 to-white flex">
      {/* Sidebar fixa no desktop */}
      <div className="hidden lg:block">
        <Sidebar
          current={tab}
          onChange={setTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-6">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-fazenda.png"
              alt="Logo da fazenda"
              className="h-10 w-10 rounded-full object-cover ring-1 ring-black/5"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <h1 className="text-2xl md:text-3xl font-bold">Fazenda Irmão coragem</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-600">{user.email}</span>
            <button
              onClick={() => {
                fetchProdutos(1, search);
                fetchOthers();
              }}
              className="rounded-lg bg-slate-200 px-3 py-1 text-slate-800 hover:bg-slate-300"
            >
              Recarregar dados
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-red-600 px-3 py-1 text-white hover:bg-red-700"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Navegação mobile (as Abas só no mobile) */}
        <div className="lg:hidden mb-4">
          <Tabs
            tabs={[
              "Painel",
              "Movimentações",
              "Produtos",
              "Defensivos",
              "Inventário",
              "Máquinas",
              "Funcionários",
              "Colheita",
              "Plantios",
            ]}
            current={tab}
            onChange={setTab}
          />
        </div>

        {/* Páginas */}
        {tab === "Painel" && (
          <Dashboard
            produtosCount={prodTotal}
            maquinasCount={maquinas.length}
            funcionariosCount={funcionarios.length}
            movimentacoesCount={movimentacoes.length}
            estoqueTotal={estoqueTotal}
            ultimasMovs={ultimasMovs}
          />
        )}

        {tab === "Movimentações" && (
          <>
            <MovForm
              key={`mf-${maquinas.length}-${funcionarios.length}`}
              produtos={produtos}
              funcionarios={funcionarios}
              maquinas={maquinas}
              onAdd={handleMovimentacao}
            />
            <MovTable data={movimentacoes} onDelete={handleExcluirMovimentacao} />
          </>
        )}

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
                  const { error } = await supabase.from("produtos").insert([produtoCorrigido]);
                  if (!error) fetchProdutos(1, search);
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
              className="mt-4 w-full border p-2"
            />

            {prodLoading ? <div className="p-4">Carregando produtos…</div> : <ProdutosTable data={produtos} />}

            {/* Paginação */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={() => fetchProdutos(1, search)} disabled={prodPage === 1} className="rounded border px-3 py-1 disabled:opacity-50">
                Primeiro
              </button>
              <button
                onClick={() => fetchProdutos(prodPage - 1, search)}
                disabled={prodPage === 1}
                className="rounded border px-3 py-1 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="px-2">
                Total: {prodTotal} • Página {prodPage} de {Math.max(1, Math.ceil(prodTotal / PROD_PAGE_SIZE))}
              </span>
              <button
                onClick={() => fetchProdutos(prodPage + 1, search)}
                disabled={prodPage >= Math.max(1, Math.ceil(prodTotal / PROD_PAGE_SIZE))}
                className="rounded border px-3 py-1 disabled:opacity-50"
              >
                Próxima
              </button>
              <button
                onClick={() => fetchProdutos(Math.max(1, Math.ceil(prodTotal / PROD_PAGE_SIZE)), search)}
                disabled={prodPage >= Math.max(1, Math.ceil(prodTotal / PROD_PAGE_SIZE))}
                className="rounded border px-3 py-1 disabled:opacity-50"
              >
                Última
              </button>
            </div>
          </>
        )}

        {tab === "Defensivos" && <Defensivos />}

        {tab === "Inventário" && <Inventario pageSize={50} />}

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
                  const { data, error } = await supabase.from("maquinas").insert([maquinaCorrigida]).select();
                  if (!error) setMaquinas((prev) => [...prev, ...data]);
                } catch (e) {
                  alert("Falha ao salvar máquina: " + e.message);
                }
              }}
            />
            <MaquinasTable data={maquinas} />
          </>
        )}

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
                  const { data, error } = await supabase.from("funcionarios").insert([funcionarioCorrigido]).select();
                  if (!error) setFuncionarios((prev) => [...prev, ...data]);
                } catch (e) {
                  alert("Falha ao salvar funcionário: " + e.message);
                }
              }}
            />
            <FuncionariosTable data={funcionarios} />
          </>
        )}

        {tab === "Colheita" && <Colheita />}
        {tab === "Plantios" && <Plantios />}
      </div>
    </div>
  );
}
