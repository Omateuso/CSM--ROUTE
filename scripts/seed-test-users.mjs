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

async function buscarUsuarioPorEmail(email) {
  // API admin não tem "getUserByEmail" direto — como são só 3 usuários de
  // teste, listar e filtrar client-side é suficiente.
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((u) => u.email === email);
}

for (const usuario of usuariosDeTeste) {
  let userId;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: usuario.email,
    password: SENHA_TESTE,
    email_confirm: true,
  });

  if (error) {
    if (!error.message.includes("already been registered")) {
      console.error(`Falha ao criar usuário ${usuario.email}: ${error.message}`);
      continue;
    }
    const existente = await buscarUsuarioPorEmail(usuario.email);
    if (!existente) {
      console.error(`Usuário ${usuario.email} já registrado, mas não foi encontrado na listagem.`);
      continue;
    }
    userId = existente.id;
  } else {
    userId = data.user.id;
  }

  // upsert: idempotente — reexecutar o script não duplica nem falha se o
  // profile já existir de uma tentativa anterior.
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, nome: usuario.nome, role: usuario.role });

  if (profileError) {
    console.error(
      `Usuário ${usuario.email} ok, mas falhou ao gravar profile: ${profileError.message}`,
    );
    continue;
  }

  console.log(`OK: ${usuario.email} / senha: ${SENHA_TESTE} (perfil: ${usuario.role})`);
}
