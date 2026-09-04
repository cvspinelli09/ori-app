// Exceção pontual verificada à mão: códigos 1088-1091 têm "Santana / Quantum 87 a 89"
// na descrição, mas a planilha original nunca capturou o Quantum. Confirmado manualmente
// que as 4 descrições são idênticas nesse trecho -- adiciona Quantum com o mesmo ano do
// Santana (87 a 89), que já estava correto.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CODIGOS = ['1088', '1089', '1090', '1091'];

async function main() {
  for (const codigo of CODIGOS) {
    const { data, error } = await supabase.from('produtos').select('id, aplicacoes').eq('codigo', codigo).single();
    if (error) { console.error(codigo, error.message); continue; }
    const jaTemQuantum = data.aplicacoes.some((a) => a.veiculo === 'Quantum');
    if (jaTemQuantum) { console.log(codigo, 'já tem Quantum, pulando'); continue; }
    const novaAplicacao = [...data.aplicacoes, { veiculo: 'Quantum', ano_apos: '87', ate: '89', geracao: '', portas: '', obs: '' }];
    const { error: updError } = await supabase.from('produtos').update({ aplicacoes: novaAplicacao }).eq('id', data.id);
    if (updError) { console.error(codigo, updError.message); continue; }
    console.log(codigo, 'Quantum adicionado.');
  }
}

main();
