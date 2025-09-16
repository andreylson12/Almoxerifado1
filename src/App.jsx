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
import Colheita from "./components/Colheita"; 
import Plantios from "./components/Plantios";// ✅ NOVO

// 🔵 PAGINAÇÃO PRODUTOS
const PROD_PAGE_SIZE = 50;

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("Movimentações");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);

  const [search, setSearch] = useState("");

  // 🔵 PAGINAÇÃO PRODUTOS - estados
  const [prodPage, setProdPage] = useState(1);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodLoading, setProdLoading] = useState(false);

  // 🔐 Controle de autenticação Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 🔵 PAGINAÇÃO PRODUTOS - função de busca remota
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

  // 🔁 Carregar máquinas, funcionários e movimentações (com tratamento de erros)
  const fetchOthers = async () => {
    try {
      const [maq, func, mov] = await Promise.all([
        supabase.from("maquinas").select("*").order("id", { ascending: true }),
        supabase.from("funcionarios").select("*").order("id", { ascending: true }),
        supabase
          .from("movimentacoes")
          .select(`
            *,
            produtos (nome, localizacao),
            funcionarios (nome),
            maquinas (identificacao)
          `)
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

  // 🔄 Carrega dados quando usuário está logado
  useEffect(() => {
    if (!user) return;
    fetchProdutos(1, search);
    fetchOthers();
  }, [user]);

  // 🔵 Pesquisar produtos (busca remota, pega desde a página 1)
  useEffect(() => {
    if (!user) return;
    fetchProdutos(1, search);
  }, [search, user]);

  // 🔐 Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setErro("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro("Erro ao fazer login: " + error.message);
    } else {
      setUser(data.user);
    }
  };

  // 🔐 Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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

          if (!estoqueError) {
            fetchProdutos(prodPage, search);
          }
        }
      }

      setMovimentacoes((prev) => [data[0], ...prev]);
    } catch (e) {
      console.error("‼️ Exceção ao salvar movimentação:", e);
      alert("Falha ao salvar movimentação: " + e.message);
    }
  };

  // 🗑️ Excluir movimentação (com reversão de estoque)
  const handleExcluirMovimentacao = async (mov) => {
    try {
      if (!mov?.id) return alert("Movimentação inválida.");

      const ok = window.confirm(
        "Excluir esta movimentação? O estoque será ajustado automaticamente."
      );
      if (!ok) return;

      let movimento = mov;
      if (
        movimento.produto_id === undefined ||
        movimento.quantidade === undefined ||
        movimento.tipo === undefined
      ) {
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

        if (novo < 0) {
          return alert("A exclusão resultaria em estoque negativo. Operação cancelada.");
        }

        const { error: upErr } = await supabase
          .from("produtos")
          .update({ quantidade: novo })
          .eq("id", produto_id);
        if (upErr) throw upErr;
      }

      const { error: delErr } = await supabase
        .from("movimentacoes")
        .delete()
        .eq("id", mov.id);
      if (delErr) throw delErr;

      setMovimentacoes((prev) => prev.filter((m) => m.id !== mov.id));
      fetchProdutos(prodPage, search);

      alert("Movimentação excluída com sucesso.");
    } catch (e) {
      console.error("Erro ao excluir movimentação:", e);
      alert("Falha ao excluir movimentação: " + (e.message || e.toString()));
    }
  };

  // 🔐 Tela de login
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded-xl shadow-lg w-80 space-y-4">
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
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  // 🖥️ Sistema principal
  const prodLastPage = Math.max(1, Math.ceil(prodTotal / PROD_PAGE_SIZE));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Cabeçalho com logo + nome */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo-fazenda.png"
            alt="Logo da fazenda"
            className="h-10 w-10 rounded-full object-cover ring-1 ring-green/5"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <h1 className="text-2xl md:text-3xl font-bold">
            Fazenda Irmão coragem
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-600">{user.email}</span>
          <button
            onClick={() => { fetchProdutos(1, search); fetchOthers(); }}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1 rounded-lg"
          >
            Recarregar dados
          </button>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg">
            Sair
          </button>
        </div>
      </div>

      <Tabs
        tabs={[
          "Movimentações",
          "Produtos",
          "Defensivos",
          "Inventário",
          "Máquinas",
          "Funcionários",
          "Colheita", 
          "Plantios",// ✅ NOVO
        ]}
        current={tab}
        onChange={setTab}
      />

      <div className="mt-6">
        {tab === "Movimentações" && (
          <>
            <MovForm
              key={`mf-${maquinas.length}-${funcionarios.length}`} // ✅ força remontagem quando listas chegam
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

                  if (!error) {
                    fetchProdutos(1, search);
                  }
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

            {prodLoading ? <div className="p-4">Carregando produtos…</div> : <ProdutosTable data={produtos} />}

            {/* 🔵 Controles de paginação */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button onClick={() => fetchProdutos(1, search)} disabled={prodPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">
                Primeiro
              </button>
              <button onClick={() => fetchProdutos(prodPage - 1, search)} disabled={prodPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">
                Anterior
              </button>
              <span className="px-2">
                Total: {prodTotal} • Página {prodPage} de {prodLastPage}
              </span>
              <button
                onClick={() => fetchProdutos(prodPage + 1, search)}
                disabled={prodPage >= prodLastPage}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Próxima
              </button>
              <button
                onClick={() => fetchProdutos(prodLastPage, search)}
                disabled={prodPage >= prodLastPage}
                className="px-3 py-1 border rounded disabled:opacity-50"
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

        {tab === "Colheita" && <Colheita />}{/* ✅ NOVO */}
        {tab === "Plantios" && <Plantios />}

      </div>
    </div>
  );
}
