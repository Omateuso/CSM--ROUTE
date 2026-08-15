// Cria os 3 usuários de teste (um por perfil) direto no Supabase Auth +
// profiles, usando a service role key (só roda no seu terminal, nunca no
// client). Dados fictícios — uso interno de desenvolvimento.
//
// Uso: node --env-file=.env.local scripts/seed-test-users.mjs

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (rode com --env-file=.env.local).",
  );
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SENHA_TESTE = "senha-teste-123";

const usuariosDeTeste = [
  { email: "gerente.teste@csm.local", nome: "Gerente Teste", role: "gerente" },
  { email: "tecnico.teste@csm.local", nome: "Técnico Teste", role: "tecnico" },
  { email: "gestao.teste@csm.local", nome: "Gestão Teste", role: "gestao" },
];

for (const usuario of usuariosDeTeste) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: usuario.email,
    password: SENHA_TESTE,
    email_confirm: true,
  });

  if (error) {
    console.error(`Falha ao criar usuário ${usuario.email}: ${error.message}`);
    continue;
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: data.user.id,
    nome: usuario.nome,
    role: usuario.role,
  });

  if (profileError) {
    console.error(
      `Usuário ${usuario.email} criado, mas falhou ao criar profile: ${profileError.message}`,
    );
    continue;
  }

  console.log(`OK: ${usuario.email} / senha: ${SENHA_TESTE} (perfil: ${usuario.role})`);
}
