import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './MinhaConta.css';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF',
  'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS',
  'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

function getRegionFromUf(uf) {
  if (['SP', 'RJ', 'MG', 'ES'].includes(uf)) {
    return 'Sudeste';
  }

  if (['PR', 'SC', 'RS'].includes(uf)) {
    return 'Sul';
  }

  if (
    ['BA', 'PE', 'CE', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI'].includes(uf)
  ) {
    return 'Nordeste';
  }

  if (['GO', 'MT', 'MS', 'DF'].includes(uf)) {
    return 'Centro-Oeste';
  }

  if (['AM', 'PA', 'AC', 'RO', 'RR', 'AP', 'TO'].includes(uf)) {
    return 'Norte';
  }

  return '';
}

export function MinhaConta() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    empresa: '',
    cargo: '',
    cnpj: '',
    cidade: '',
    uf: '',
    receber_comunicacoes: false,
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!session?.user?.id) {
        navigate('/login', {
        state: { from: '/conta' },
        });
        return;
    }

    let cancelled = false;

    async function loadProfile() {
        const { data, error: loadError } = await supabase
        .from('profiles')
        .select(`
            nome,
            telefone,
            empresa,
            cargo,
            cnpj,
            cidade,
            uf,
            receber_comunicacoes
        `)
        .eq('id', session.user.id)
        .single();

        if (cancelled) return;

        if (loadError) {
        setError('Não foi possível carregar seus dados.');
        return;
        }

        setForm({
        nome: data?.nome || '',
        telefone: data?.telefone || '',
        empresa: data?.empresa || '',
        cargo: data?.cargo || '',
        cnpj: data?.cnpj || '',
        cidade: data?.cidade || '',
        uf: data?.uf || '',
        receber_comunicacoes:
            data?.receber_comunicacoes ?? false,
        });
    }

    loadProfile();

    return () => {
        cancelled = true;
    };
    }, [authLoading, session?.user?.id, navigate]);

  const region = useMemo(
    () => getRegionFromUf(form.uf),
    [form.uf]
  );

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!session?.user?.id) return;

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          nome: form.nome.trim() || null,
          telefone: form.telefone.trim() || null,
          empresa: form.empresa.trim() || null,
          cargo: form.cargo.trim() || null,
          cnpj: form.cnpj.trim() || null,
          cidade: form.cidade.trim() || null,
          uf: form.uf || null,
          regiao: region || null,
          receber_comunicacoes:
            form.receber_comunicacoes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id)
        .select('id');

      if (updateError) {
        throw updateError;
      }

      if (!updatedProfile?.length) {
        throw new Error('O perfil não foi atualizado.');
      }

      setMessage('Dados atualizados com sucesso.');

      setTimeout(() => {
        navigate('/catalogo');
      }, 800);
    } catch (err) {
      console.error(
        'Erro ao atualizar conta:',
        err
      );

      setError(
        'Não foi possível salvar suas alterações.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !session) {
    return (
      <div className="minha-conta-loading">
        Carregando conta...
      </div>
    );
  }

  return (
    <div className="minha-conta-page">
      <header className="minha-conta-header">
        <button
          type="button"
          className="minha-conta-back"
          onClick={() => navigate('/catalogo')}
        >
          ← Voltar ao catálogo
        </button>

        <div>
          <h1>Minha conta</h1>
          <p>
            Mantenha seus dados atualizados para uma
            experiência mais personalizada com a Ori.
          </p>
        </div>
      </header>

      <main className="minha-conta-content">
        <form
          className="minha-conta-form"
          onSubmit={handleSubmit}
        >
          <section className="minha-conta-card">
            <div className="minha-conta-card-heading">
              <h2>Dados pessoais</h2>
              <p>
                Informações básicas da sua conta.
              </p>
            </div>

            <div className="minha-conta-grid">
              <label>
                <span>Nome</span>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(event) =>
                    updateField(
                      'nome',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={session.user.email || ''}
                  disabled
                />
              </label>

              <label>
                <span>Telefone</span>
                <input
                  type="text"
                  value={form.telefone}
                  onChange={(event) =>
                    updateField(
                      'telefone',
                      event.target.value
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="minha-conta-card">
            <div className="minha-conta-card-heading">
              <h2>Empresa</h2>
              <p>
                Complete seus dados profissionais.
              </p>
            </div>

            <div className="minha-conta-grid">
              <label>
                <span>Empresa</span>
                <input
                  type="text"
                  value={form.empresa}
                  onChange={(event) =>
                    updateField(
                      'empresa',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>Cargo</span>
                <input
                  type="text"
                  value={form.cargo}
                  onChange={(event) =>
                    updateField(
                      'cargo',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>CNPJ</span>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={(event) =>
                    updateField(
                      'cnpj',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>Cidade</span>
                <input
                  type="text"
                  value={form.cidade}
                  onChange={(event) =>
                    updateField(
                      'cidade',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>UF</span>

                <select
                  value={form.uf}
                  onChange={(event) =>
                    updateField(
                      'uf',
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Selecione
                  </option>

                  {UFS.map((uf) => (
                    <option
                      key={uf}
                      value={uf}
                    >
                      {uf}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Região</span>
                <input
                  type="text"
                  value={region}
                  disabled
                  placeholder="Definida pela UF"
                />
              </label>
            </div>
          </section>

          <section className="minha-conta-card">
            <div className="minha-conta-card-heading">
                <h2>Preferências</h2>
                <p>
                Você controla como deseja receber
                informações da Ori.
                </p>
            </div>

            <div className="minha-conta-preferences-layout">
                <div className="minha-conta-preferences-main">
                <label className="minha-conta-communication">
                    <input
                    type="checkbox"
                    checked={form.receber_comunicacoes}
                    onChange={(event) =>
                        updateField(
                        'receber_comunicacoes',
                        event.target.checked
                        )
                    }
                    />

                    <div>
                    <strong>
                        Quero receber novidades e informações
                        da Ori
                    </strong>

                    <span>
                        Novidades, lançamentos, conteúdos e
                        informações comerciais. Você pode
                        alterar esta preferência a qualquer
                        momento.
                    </span>
                    </div>
                </label>

                {error && (
                    <div className="minha-conta-error">
                    {error}
                    </div>
                )}

                {message && (
                    <div className="minha-conta-success">
                    {message}
                    </div>
                )}
                </div>

                <div className="minha-conta-preferences-side">
                <div className="minha-conta-actions">
                    <button
                    type="button"
                    className="minha-conta-secondary"
                    onClick={() => navigate('/catalogo')}
                    >
                    Cancelar
                    </button>

                    <button
                    type="submit"
                    className="minha-conta-primary"
                    disabled={saving}
                    >
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                </div>
                </div>
            </div>
            </section>
        </form>
      </main>
    </div>
  );
}