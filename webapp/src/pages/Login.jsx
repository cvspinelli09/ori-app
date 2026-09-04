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
    const from = location.state?.from || (localStorage.getItem(PENDING_SELECTION_KEY) ? '/catalogo' : null);
    if (from) navigate(from, { replace: true });
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
    if (error) setError(error.message);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-wrap"><img src="/assets/logo.png" alt="Ori" /></div>
        <h1>Acessar o Ori Peças</h1>
        <p className="sub">Entre com Google ou receba um código por e-mail</p>

        {error && <div className="login-error">{error}</div>}

        <button type="button" className="btn-google" onClick={signInWithGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20 20-8.9 20-20c0-1.4-.1-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3c-7.7 0-14.3 4.4-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 43c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 34.5 26.7 35 24 35c-5.3 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 38.5 16.2 43 24 43z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C40.8 36.3 44 30.6 44 23c0-1.4-.1-2.7-.4-4z"/>
          </svg>
          Entrar com Google
        </button>

        <div className="login-divider">ou</div>

        {!otpSent ? (
          <form onSubmit={handleSendOtp}>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit">Enviar código por e-mail</button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <input
              type="text"
              placeholder="Código recebido por e-mail"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <button type="submit">Confirmar</button>
          </form>
        )}

        <div className="login-hint">
          Clientes, vendedores e admin da Ori entram por aqui — cada um vê só o que pode.
        </div>
      </div>
    </div>
  );
}
