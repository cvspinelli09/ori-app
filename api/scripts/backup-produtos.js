// Backup completo da tabela produtos antes de uma mudança em massa.
// Uso: node scripts/backup-produtos.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error, count } = await supabase.from('produtos').select('*', { count: 'exact' }).limit(5000);
  if (error) { console.error(error); process.exit(1); }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `produtos_backup_${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(data, null, 1));
  console.log(`Backup salvo: ${outFile} (${data.length} linhas, total na tabela: ${count})`);
}

main();
