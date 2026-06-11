// Cria um usuario do painel admin (ja confirmado, sem precisar de e-mail).
// O primeiro usuario criado vira automaticamente o dono (owner).
// Uso: npm run create-admin -- email@exemplo.com senha123 "Nome Completo"
import { createClient } from "@supabase/supabase-js";

const [email, password, fullName] = process.argv.slice(2);

if (!email || !password || !fullName) {
  console.error(
    'Uso: npm run create-admin -- email@exemplo.com senha123 "Nome Completo"'
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

if (error) {
  console.error("Erro ao criar usuario:", error.message);
  process.exit(1);
}

const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", data.user.id)
  .single();

console.log(`Usuario criado: ${email} (papel: ${profile?.role ?? "barber"})`);
