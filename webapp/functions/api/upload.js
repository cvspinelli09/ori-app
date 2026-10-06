function json(data, status = 200) {
  return Response.json(data, { status });
}

async function requireAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return { error: json({ error: 'Não autenticado.' }, 401) };
  }

  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!userResponse.ok) {
    return { error: json({ error: 'Sessão inválida.' }, 401) };
  }

  const user = await userResponse.json();

  if (!user?.id) {
    return { error: json({ error: 'Sessão inválida.' }, 401) };
  }

  const profileResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
    {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );

  if (!profileResponse.ok) {
    return {
      error: json(
        { error: 'Só administradores podem fazer isso.' },
        403
      ),
    };
  }

  const profiles = await profileResponse.json();

  if (!Array.isArray(profiles) || profiles[0]?.role !== 'admin') {
    return {
      error: json(
        { error: 'Só administradores podem fazer isso.' },
        403
      ),
    };
  }

  return { user };
}

function getExtension(filename) {
  const name = String(filename || '');
  const lastDot = name.lastIndexOf('.');

  if (lastDot <= 0 || lastDot === name.length - 1) {
    return '.jpg';
  }

  return name.slice(lastDot);
}

function randomHex(bytes = 6) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);

  return Array.from(array, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export async function onRequestPost({ request, env }) {
  try {
    const admin = await requireAdmin(request, env);
    if (admin.error) return admin.error;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return json({ error: 'Nenhum arquivo enviado.' }, 400);
    }

    const MAX_FILE_SIZE = 8 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      return json(
        { error: 'Arquivo excede o limite de 8 MB.' },
        413
      );
    }

    const folder = String(formData.get('folder') || 'admin')
      .replace(/[^a-z0-9_-]/gi, '');

    const ext = getExtension(file.name);
    const key =
      `${folder}/${Date.now()}-${randomHex(6)}${ext}`;

    await env.ORI_FOTOS.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || 'image/jpeg',
      },
    });

    const baseUrl = String(env.R2_PUBLIC_BASE_URL || '')
      .replace(/\/+$/, '');

    return json({
      url: `${baseUrl}/${key}`,
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Falha ao enviar a foto.' }, 500);
  }
}
