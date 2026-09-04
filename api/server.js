require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2, bucket, publicUrl } = require('./lib/r2');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Supabase não configurado — defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

// placeholder evita crash do createClient antes do .env ser preenchido
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

if (!process.env.RESEND_API_KEY) {
  console.warn('Resend não configurado — defina RESEND_API_KEY no .env');
}
const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');

// Exige um usuário Supabase autenticado com profiles.role = 'admin'.
// O token vem do frontend (sessão do supabase-js), validado aqui contra o Supabase de verdade.
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: 'Sessão inválida.' });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();
  if (profileError || profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Só administradores podem fazer isso.' });
  }
  next();
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  const folder = (req.body.folder || 'admin').replace(/[^a-z0-9_-]/gi, '');
  const ext = path.extname(req.file.originalname) || '.jpg';
  const key = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

  try {
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    res.json({ url: publicUrl(key) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao enviar a foto.' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/contact', async (req, res) => {
  const { nome, email, telefone, empresa, cnpj, mensagem } = req.body || {};
  if (!nome || !email || !telefone || !mensagem) {
    return res.status(400).json({ error: 'Nome, e-mail, telefone e mensagem são obrigatórios.' });
  }

  const html = `
    <p><strong>Nome:</strong> ${nome}</p>
    <p><strong>E-mail:</strong> ${email}</p>
    <p><strong>Telefone:</strong> ${telefone}</p>
    ${empresa ? `<p><strong>Empresa:</strong> ${empresa}</p>` : ''}
    ${cnpj ? `<p><strong>CNPJ:</strong> ${cnpj}</p>` : ''}
    <p><strong>Mensagem:</strong><br>${String(mensagem).replace(/\n/g, '<br>')}</p>
  `;

  try {
    const { error } = await resend.emails.send({
      from: 'Ori Auto Peças <site@ori.com.br>',
      to: process.env.CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `Contato pelo site — ${nome}`,
      html,
    });
    if (error) return res.status(502).json({ error: error.message || 'Falha ao enviar e-mail.' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno ao enviar e-mail.' });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log(`API do Ori rodando na porta ${process.env.PORT || 3001}`);
});
