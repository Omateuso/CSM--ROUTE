"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Inter } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import { MAPA_ROTA_SVG } from "./mapa-rota-svg";
import styles from "./login.module.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

const SENHA_TESTE = "senha-teste-123";
const CONTAS_DE_TESTE = [
  { label: "Gerente", email: "gerente.teste@csm.local" },
  { label: "Técnico", email: "tecnico.teste@csm.local" },
  { label: "Gestão", email: "gestao.teste@csm.local" },
];

// Uma vez por sessão do navegador (decisão do usuário, 24/08/2026) — se a aba
// fechar e reabrir, ou for outra aba/janela nova, a introdução toca de novo.
const INTRO_SESSION_KEY = "csm-route-login-intro-visto";

// Mesmo ponto usado pelo pino "alvo-mk" final e pelo fim do path #cinza no
// SVG aprovado — é onde a seta fica parada quando a animação não roda.
const DESTINO = { x: 971.4, y: 281.7, anguloGraus: -23.4 };

type ElementoAnimavel = Element & { beginElement?: () => void };

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const shellRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const container = mapaRef.current;
    if (!container) return;

    function toca(id: string) {
      const el = container?.querySelector(`#${id}`) as ElementoAnimavel | null;
      try {
        el?.beginElement?.();
      } catch {
        // SMIL indisponível no navegador — a cena segue no estado base
      }
    }
    function liga(seletor: string) {
      container?.querySelectorAll(seletor).forEach((e) => e.classList.add("on"));
    }
    function estadoFinalEstatico() {
      ["a-cinza", "a-glow1", "a-lar1"].forEach((id) => {
        const path = container?.querySelector(`#${id}`)?.parentElement;
        path?.setAttribute("stroke-dasharray", "1000 1000 0 0");
      });
      liga(".pino");
      liga(".ponto");
      liga(".alvo-mk");
      const seta = container?.querySelector(".seta");
      if (seta) {
        seta.setAttribute("transform", `translate(${DESTINO.x},${DESTINO.y}) rotate(${DESTINO.anguloGraus})`);
        seta.classList.add("parado");
      }
    }

    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduz) {
      // Requisito de acessibilidade: entrega a cena já montada, sem tocar
      // nenhuma animação (nem via SMIL, nem via CSS) — não é só remover o
      // atraso, é não animar de fato.
      estadoFinalEstatico();
      try {
        sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      } catch {
        // sessionStorage indisponível (ex.: navegação privada restrita) — sem problema, só repete a intro
      }
      shellRef.current?.classList.add(styles.pronto);
      return;
    }

    let jaViu = false;
    try {
      jaViu = sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
    } catch {
      jaViu = false;
    }

    if (jaViu) {
      // Já visto nesta sessão do navegador — mesmo efeito do botão "Pular
      // introdução", sem o storyboard completo de novo.
      shellRef.current?.classList.add(styles.pronto);
      ["a-cinza", "a-glow1", "a-lar1"].forEach(toca);
      liga(".pino");
      liga(".ponto");
      liga(".alvo-mk");
      const t = window.setTimeout(() => {
        ["a-seta", "a-fade", "a-glow2", "a-lar2"].forEach(toca);
      }, 900);
      timersRef.current.push(t);
      return;
    }

    function em(ms: number, fn: () => void) {
      timersRef.current.push(window.setTimeout(fn, ms));
    }

    // a rota é traçada
    em(3100, () => ["a-cinza", "a-glow1", "a-lar1"].forEach(toca));
    // a introdução se abre o suficiente pro mapa por trás já poder ser visto
    em(4100, () => {
      introRef.current?.classList.add(styles.foi);
      try {
        sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      } catch {
        // sem problema, só repete a intro numa próxima aba
      }
    });
    // marcadores surgem na ordem em que a rota passa por eles
    em(4500, () => liga(".pino"));
    em(4750, () => liga(".ponto"));
    em(5000, () => liga(".alvo-mk"));
    // a seta entra e o laranja passa a recuar atrás dela, em loop
    em(5500, () => ["a-seta", "a-fade", "a-glow2", "a-lar2"].forEach(toca));

    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  function handlePular() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    shellRef.current?.classList.add(styles.pronto);
    introRef.current?.classList.add(styles.foi);
    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    } catch {
      // sem problema, só repete a intro numa próxima aba
    }

    const container = mapaRef.current;
    function toca(id: string) {
      const el = container?.querySelector(`#${id}`) as ElementoAnimavel | null;
      try {
        el?.beginElement?.();
      } catch {
        // segue sem animar
      }
    }
    function liga(seletor: string) {
      container?.querySelectorAll(seletor).forEach((e) => e.classList.add("on"));
    }
    ["a-cinza", "a-glow1", "a-lar1"].forEach(toca);
    liga(".pino");
    liga(".ponto");
    liga(".alvo-mk");
    window.setTimeout(() => {
      ["a-seta", "a-fade", "a-glow2", "a-lar2"].forEach(toca);
    }, 900);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
      setErro("E-mail ou senha inválidos.");
      setCarregando(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className={`${styles.shell} ${inter.className}`} ref={shellRef}>
      <section className={styles.stage}>
        <div className={styles.mapa} ref={mapaRef} dangerouslySetInnerHTML={{ __html: MAPA_ROTA_SVG }} />

        <div className={styles.marca}>
          <Image src="/logo-igedes.png" alt="iGEDES" width={34} height={34} priority />
          <b>Sistema de Rota Inteligente</b>
        </div>
      </section>

      <section className={styles.side}>
        <div className={styles.cardBox}>
          <h1 className={styles.titulo}>Bem-vindo ao Sistema de Rota Inteligente</h1>
          <p className={styles.lead}>Use as credenciais fornecidas pela coordenação para acessar o painel.</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className={styles.label}>
                E-mail
              </label>
              <div className={styles.field}>
                <svg
                  className={styles.ico}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="seu.nome@csm.local"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            <div>
              <label htmlFor="senha" className={styles.label}>
                Senha
              </label>
              <div className={styles.field}>
                <svg
                  className={styles.ico}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className={styles.input}
                />
                <button
                  type="button"
                  className={styles.peek}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setMostrarSenha((v) => !v)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            <div className={styles.row}>
              <label className={styles.check}>
                <input type="checkbox" /> Manter conectado
              </label>
              <a className={styles.forgot} href="#">
                Esqueci minha senha
              </a>
            </div>

            {erro && (
              <p role="alert" className={styles.erro}>
                {erro}
              </p>
            )}

            <button type="submit" className={styles.submit} disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </form>

          <div className={styles.foot}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.6 3.8 17 5 19 5a1 1 0 0 1 1 1Z" />
            </svg>
            Acesso restrito — uso monitorado e registrado.
          </div>

          {process.env.NODE_ENV !== "production" && (
            <div className={styles.devContas}>
              <p>Contas de teste (dev)</p>
              <div className={styles.lista}>
                {CONTAS_DE_TESTE.map((conta) => (
                  <button
                    key={conta.email}
                    type="button"
                    className={styles.devConta}
                    onClick={() => {
                      setEmail(conta.email);
                      setSenha(SENHA_TESTE);
                    }}
                  >
                    {conta.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className={styles.intro} ref={introRef}>
        <div className={styles.alvo}>
          <Image src="/logo-igedes.png" alt="iGEDES" width={92} height={92} priority />
          <div className={styles.n}>Sistema de Rota Inteligente</div>
          <div className={styles.s}>iGEDES</div>
        </div>
      </div>
      <button type="button" className={styles.pular} onClick={handlePular}>
        Pular introdução
      </button>
    </div>
  );
}
