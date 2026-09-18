import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FOCUS_RING } from "@/lib/ui/styles";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

type RelatorioLinha = {
  id: string;
  assunto: string | null;
  status: string;
  criado_em: string;
  docx_path: string | null;
  profiles: { nome: string } | { nome: string }[] | null;
};

export default async function HistoricoRelatoriosRtPage({ params }: PageProps<"/relatorios/rt/[rtId]">) {
  const { rtId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil gerente.</p>
      </div>
    );
  }

  const [{ data: rtRaw }, { data: relatoriosRaw }] = await Promise.all([
    supabase.from("rts").select("codigo, nome, endereco, bairro, caps(nome)").eq("id", rtId).maybeSingle(),
    supabase
      .from("relatorios_rt")
      .select("id, assunto, status, criado_em, docx_path, profiles(nome)")
      .eq("rt_id", rtId)
      .order("criado_em", { ascending: false }),
  ]);

  if (!rtRaw) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-10">
        <Link href="/relatorios/rt" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
          ← Relatório de RT
        </Link>
        <p className="mt-6 text-sm text-text-secondary">RT não encontrada.</p>
      </div>
    );
  }

  const relatorios = (relatoriosRaw ?? []) as RelatorioLinha[];
  const caminhosDocx = relatorios.map((r) => r.docx_path).filter((p): p is string => !!p);

  const urlPorCaminho = new Map<string, string>();
  if (caminhosDocx.length > 0) {
    const { data: assinadas } = await supabase.storage.from("relatorios-rt").createSignedUrls(caminhosDocx, 3600);
    for (const item of assinadas ?? []) {
      if (item.signedUrl) urlPorCaminho.set(item.path ?? "", item.signedUrl);
    }
  }

  const capsNome = unwrapOne(rtRaw.caps)?.nome ?? "—";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-10">
      <Link href="/relatorios/rt" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
        ← Relatório de RT
      </Link>

      <header className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-mono text-2xl font-semibold text-text-primary">{rtRaw.codigo as string}</h1>
            <span className="text-lg text-text-secondary">{rtRaw.nome as string}</span>
          </div>
          <p className="mt-1 text-sm text-text-tertiary">
            {rtRaw.endereco as string}, {rtRaw.bairro as string} · {capsNome}
          </p>
        </div>
        <Link
          href={`/relatorios/rt/novo?rt=${rtId}`}
          className={`rounded-[var(--radius-sm)] bg-accent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-on-accent transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
        >
          + Novo relatório para esta RT
        </Link>
      </header>

      <section className="mt-6">
        {relatorios.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-input px-4 py-6 text-center text-sm text-text-tertiary">
            Nenhum relatório registrado ainda pra essa RT.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {relatorios.map((r) => {
              const responsavel = unwrapOne(r.profiles)?.nome ?? "—";
              const url = r.docx_path ? urlPorCaminho.get(r.docx_path) : null;
              return (
                <li key={r.id} className="rounded-[var(--radius-md)] bg-surface shadow-lift p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{r.assunto || "(sem assunto)"}</p>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
                        r.status === "finalizado"
                          ? "bg-success/10 text-success"
                          : "bg-surface-input text-text-tertiary"
                      }`}
                    >
                      {r.status === "finalizado" ? "Finalizado" : "Rascunho"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {fmtData.format(new Date(r.criado_em))} · {responsavel}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    {r.status === "rascunho" && (
                      <Link
                        href={`/relatorios/rt/novo?rascunho=${r.id}`}
                        className={`text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
                      >
                        Continuar rascunho →
                      </Link>
                    )}
                    {url && (
                      <a
                        href={url}
                        className={`text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
                      >
                        Baixar .docx →
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
