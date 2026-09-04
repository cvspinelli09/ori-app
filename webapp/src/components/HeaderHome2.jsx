import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { cliente: 'Cliente/Oficina', vendedor: 'Vendedor', admin: 'Admin Ori' };
const ROLE_ROUTE = {
  cliente: '/conta',
  vendedor: '/vendedor',
  admin: '/admin',
};

export function HeaderHome2() {
  const { session, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const navLinks = (
  <>
    <a href="#a-ori">A Ori</a>
    <a href="#categorias">Categorias</a>
    <a href="#destaques">Destaques</a>
    <a href="#contato">Contato</a>

  </>
);

  return (
    <header className="home2-header-wrap">
      <div className="home2-topbar">
        <div className="home2-container home2-topbar-inner">
          <div className="home2-topbar-badges">
            <span>Indústria de autopeças desde 1995</span>
            <span>+3500 SKUs</span>
            <span>Catálogo sempre atualizado</span>
            <span>Suporte especializado</span>
          </div>
          <div className="home2-topbar-session">
            {!session ? (
              <Link to="/login">Entrar</Link>
            ) : (
              <span className="home2-session-badge">
                <Link to={ROLE_ROUTE[profile?.role] ?? '/'}>
                  {profile?.nome?.trim().split(/\s+/)[0] ||
                    session?.user?.user_metadata?.full_name?.trim().split(/\s+/)[0] ||
                    session?.user?.email?.split('@')[0] ||
                    ROLE_LABEL[profile?.role] ||
                    '...'}
                </Link>

                <button type="button" onClick={signOut}>
                  Sair
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="home2-header">
        <div className="home2-container home2-header-inner">
          <Link to="/" className="home2-logo">
            <img src="/assets/logo.png" alt="Ori" />
          </Link>

          <nav className="home2-nav">{navLinks}</nav>

          <div className="home2-header-actions">
            <Link className="home2-cta-btn" to="/catalogo">Monte seu Catálogo</Link>
            <button type="button" className="home2-search-btn" aria-label="Buscar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            <button type="button" className="home2-menu-toggle" aria-label="Abrir menu" onClick={() => setOpen((v) => !v)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <nav className={`home2-mobile-nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          {navLinks}
          <Link className="home2-cta-btn" to="/catalogo">Monte seu Catálogo</Link>
          {!session ? (
            <Link to="/login">Entrar</Link>
          ) : (
            <span className="home2-session-badge">
              <span>
                {profile?.nome?.trim().split(/\s+/)[0] ||
                  session?.user?.user_metadata?.full_name?.trim().split(/\s+/)[0] ||
                  session?.user?.email?.split('@')[0] ||
                  ROLE_LABEL[profile?.role] ||
                  '...'}
              </span>
              <button type="button" onClick={signOut}>Sair</button>
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
