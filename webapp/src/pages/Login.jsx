import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/login.css';

const PENDING_SELECTION_KEY = 'catalogo2_pending_selection';

export function Login() {
  const { session, signInWithGoogle, signInWithEmailOtp, verifyEmailOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  // Retorno pós-login: puramente navegação (React Router), não é autenticação nova. Se veio
  // de uma ação que exigiu login (ex.: Salvar seleção em /catalogo), volta pra lá assim que
  // a sessão existente ficar disponível — o consumo do que estava pendente acontece só na
  // página de destino, nunca aqui.
  useEffect(() => {
  if (!session) return;

  const destination =
    location.state?.from ||
      (localStorage.getItem(PENDING_SELECTION_KEY) ? '/catalogo' : '/');

    navigate(destination, { replace: true });
  }, [session, location.state, navigate]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    const { error } = await signInWithEmailOtp(email);
    if (error) setError(error.message);
    else setOtpSent(true);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    const { error } = await verifyEmailOtp(email, token);

    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-brand">
          <div className="login-brand-logo">
            <img src="/assets/logo.png" alt="Ori Auto Peças" />
          </div>

          <span className="login-eyebrow">Portal Ori</span>

          <h1>Acesse sua conta</h1>

          <p className="login-intro">
            Entre para consultar o catálogo, salvar seleções e acessar os recursos exclusivos da Ori.
          </p>
        </div>

        <div className="login-card">
          {error && <div className="login-error">{error}</div>}

          <section className="login-option">
            <div className="login-option-heading">
              <span className="login-option-number">1</span>
              <div>
                <strong>Entrar com Google</strong>
                <small>Acesso rápido com sua conta Google.</small>
              </div>
            </div>

            <button
              type="button"
              className="btn-google"
              onClick={signInWithGoogle}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20 20-8.9 20-20c0-1.4-.1-2.7-.4-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3c-7.7 0-14.3 4.4-17.7 10.7z"/>
                <path fill="#4CAF50" d="M24 43c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 34.5 26.7 35 24 35c-5.3 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 38.5 16.2 43 24 43z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C40.8 36.3 44 30.6 44 23c0-1.4-.1-2.7-.4-4z"/>
              </svg>

              Continuar com Google
            </button>
          </section>

          <section className="login-option">
            <div className="login-option-heading">
              <span className="login-option-number">2</span>
              <div>
                <strong>Entrar com seu e-mail</strong>
                <small>
                  {otpSent
                    ? `Digite o código enviado para ${email}.`
                    : 'Use seu e-mail cadastrado para acessar.'}
                </small>
              </div>
            </div>

            {!otpSent ? (
              <form onSubmit={handleSendOtp}>
                <label htmlFor="login-email">E-mail</label>

                <input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <button type="submit">
                  Receber código de acesso
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <label htmlFor="login-token">Código de acesso</label>

                <input
                  id="login-token"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />

                <button type="submit">
                  Confirmar código
                </button>

                <button
                  type="button"
                  className="login-change-email"
                  onClick={() => {
                    setOtpSent(false);
                    setToken('');
                    setError('');
                  }}
                >
                  Usar outro e-mail
                </button>
              </form>
            )}
          </section>

          <section className="login-first-access">
            <div className="login-option-heading">
              <span className="login-option-number">3</span>
              <div>
                <strong>Primeiro acesso?</strong>
                <small>
                  Informe seu e-mail acima. Vamos confirmar sua identidade com um código.
                  Depois, neste dispositivo, seu acesso permanece conectado enquanto sua sessão estiver válida.
                </small>
              </div>
            </div>
          </section>

          <div className="login-footer-note">
            Acesso exclusivo para clientes, vendedores e equipe Ori.
          </div>
        </div>
      </div>
    </div>
  );
}
