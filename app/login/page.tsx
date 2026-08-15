"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SENHA_TESTE = "senha-teste-123";

const CONTAS_DE_TESTE = [
  { label: "Gerente", email: "gerente.teste@csm.local" },
  { label: "Técnico", email: "tecnico.teste@csm.local" },
  { label: "Gestão", email: "gestao.teste@csm.local" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro("E-mail ou senha inválidos.");
      setCarregando(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-border bg-surface p-8">
        <h1 className="text-lg font-semibold text-text-primary">
          Gestão Operacional de Manutenção
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Entre com sua conta para continuar.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text-secondary">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="senha" className="text-sm font-medium text-text-secondary">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          {erro && (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="mt-2 rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {process.env.NODE_ENV !== "production" && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-medium text-text-tertiary">
              Contas de teste (dev)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CONTAS_DE_TESTE.map((conta) => (
                <button
                  key={conta.email}
                  type="button"
                  onClick={() => {
                    setEmail(conta.email);
                    setSenha(SENHA_TESTE);
                  }}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                >
                  {conta.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
