// Runner de migrations: aplica os arquivos .sql de supabase/migrations
// em ordem, registrando os ja executados na tabela _migrations.
// Uso: npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import "dotenv/config";

const MIGRATIONS_DIR = path.resolve("supabase/migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL nao definida no .env.local / .env");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  await client.query(`
    create table if not exists public._migrations (
      name text primary key,
      executed_at timestamptz not null default now()
    )
  `);

  await client.query(`
    alter table public._migrations enable row level security
  `);
  await client.query(`
    revoke all on table public._migrations from anon, authenticated
  `);

  const { rows } = await client.query("select name from public._migrations");
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`Aplicando ${file}...`);

    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public._migrations (name) values ($1)", [
        file,
      ]);
      await client.query("commit");
      count++;
    } catch (err) {
      await client.query("rollback");
      console.error(`Erro em ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log(
    count === 0
      ? "Banco ja esta atualizado. Nenhuma migration pendente."
      : `${count} migration(s) aplicada(s) com sucesso.`
  );
} finally {
  await client.end();
}
