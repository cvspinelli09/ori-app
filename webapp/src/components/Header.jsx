import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { cliente: 'Cliente/Oficina', vendedor: 'Vendedor', admin: 'Admin Ori' };

export function Header() {
  const { session, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const links = (
    <>
      <a href="/#bem-vindo">A Ori</a>
      <a href="/#categorias">Categorias</a>
      <a href="/#destaque">Destaques</a>
      <a href="/#contato">Contato</a>
      {profile?.role === 'admin' && <Link className="admin-link" to="/admin">Painel Admin</Link>}
      <Link className="nav-cta" to="/catalogo">Monte seu Catálogo</Link>
      {!session ? (
        <Link className="login-link" to="/login">Entrar</Link>
      ) : (
        <span className="session-badge">
          <span className="role-tag">
            {profile?.nome?.trim().split(/\s+/)[0] ||
              session?.user?.user_metadata?.full_name?.trim().split(/\s+/)[0] ||
              session?.user?.email?.split('@')[0] ||
              ROLE_LABEL[profile?.role] ||
              '...'}
          </span>
          <button onClick={signOut}>Sair</button>
        </span>
      )}
    </>
  );

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/"><img src="/assets/logo.png" alt="Ori" /></Link>
        <nav>{links}</nav>
        <button className="menu-toggle" aria-label="Abrir menu" onClick={() => setOpen((v) => !v)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
      <nav className={`mobile-nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>{links}</nav>
    </header>
  );
}
