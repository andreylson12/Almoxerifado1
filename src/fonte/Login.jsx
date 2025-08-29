import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [user, setUser] = useState(null);
  const [erro, setErro] = useState("");

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      {!user ? (
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
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-lg w-80 text-center space-y-4">
          <h2 className="text-xl font-semibold">Bem-vindo</h2>
          <p>{user.email}</p>
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
