function json(data, status = 200) {
  return Response.json(data, { status });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function onRequestPost({ request, env }) {
  try {
    const { nome, email, telefone, empresa, cnpj, mensagem } =
      await request.json();

    if (!nome || !email || !telefone || !mensagem) {
      return json(
        { error: 'Nome, e-mail, telefone e mensagem são obrigatórios.' },
        400
      );
    }

    const html = `
      <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
      <p><strong>Telefone:</strong> ${escapeHtml(telefone)}</p>
      ${empresa ? `<p><strong>Empresa:</strong> ${escapeHtml(empresa)}</p>` : ''}
      ${cnpj ? `<p><strong>CNPJ:</strong> ${escapeHtml(cnpj)}</p>` : ''}
      <p><strong>Mensagem:</strong><br>${escapeHtml(mensagem).replace(/\n/g, '<br>')}</p>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Ori Auto Peças <site@ori.com.br>',
        to: env.CONTACT_TO_EMAIL,
        reply_to: email,
        subject: `Contato pelo site — ${nome}`,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend:', data);
      return json(
        { error: data?.message || 'Falha ao enviar e-mail.' },
        502
      );
    }

    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno ao enviar e-mail.' }, 500);
  }
}
