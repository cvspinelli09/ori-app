import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';
import '../styles/home.css';

const DEFAULT_BANNERS = [
  '/assets/banner_superior/gde_5_0.jpg',
  '/assets/banner_superior/gde_6_0.jpg',
  '/assets/banner_superior/gde_banner-site-instagra.jpg',
];

const DEFAULT_DESTAQUE_CATEGORIAS = [
  'Fechaduras de Portas',
  'Cilindros de Ignição',
  'Maçanetas Externas',
  'Fechos de Capô',
  'Cilindros de Portas',
];

const DEFAULT_INSTAGRAM_POSTS = [
  '/assets/instagram/post1.jpg',
  '/assets/instagram/post2.jpg',
  '/assets/instagram/post3.jpg',
  '/assets/instagram/post4.jpg',
  '/assets/instagram/post5.jpg',
  '/assets/instagram/post6.jpg',
];

function TopBanner({ banners }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const goTo = (i) => setIndex((i + banners.length) % banners.length);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    timerRef.current = setInterval(() => goTo(index + 1), 3000);
    return () => clearInterval(timerRef.current);
  }, [index, banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className="top-banner">
      <div
        className="top-banner-inner"
        onMouseEnter={() => clearInterval(timerRef.current)}
        onMouseLeave={() => { if (banners.length > 1) timerRef.current = setInterval(() => goTo(index + 1), 3000); }}
      >
        <div className="top-banner-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {banners.map((src) => (
            <div className="tb-slide" key={src}><img src={src} alt="Banner Ori" /></div>
          ))}
        </div>
        <div className="fnav prev" onClick={() => goTo(index - 1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><polyline points="15 18 9 12 15 6" /></svg>
        </div>
        <div className="fnav next" onClick={() => goTo(index + 1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      </div>
      <div className="fdots">
        {banners.map((_, i) => (
          <button key={i} className={`fdot ${i === index ? 'active' : ''}`} onClick={() => goTo(i)} aria-label={`Banner ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

function Showcase({ groups }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (groups.length <= 1) return undefined;
    timerRef.current = setInterval(() => setActive((a) => (a + 1) % groups.length), 5000);
    return () => clearInterval(timerRef.current);
  }, [groups.length]);

  if (groups.length === 0) {
    return <div className="showcase-empty">Nenhuma categoria em destaque configurada ainda.</div>;
  }

  const palette = ['#0f2140', '#1c3a63', '#325387', '#4d8bba', '#6ba0cf'];

  return (
    <div
      className="showcase"
      onMouseEnter={() => clearInterval(timerRef.current)}
      onMouseLeave={() => {
        if (groups.length > 1) timerRef.current = setInterval(() => setActive((a) => (a + 1) % groups.length), 5000);
      }}
    >
      {groups.map((g, i) => (
        <div className={`showcase-item ${i === active ? 'active' : ''}`} key={g.categoria}>
          <button
            type="button"
            className="showcase-collapsed"
            style={{ background: palette[i % palette.length] }}
            onClick={() => setActive(i)}
          >
            <span className="showcase-collapsed-label">{g.categoria}</span>
          </button>
          <div className="showcase-expanded">
            <div className="showcase-expanded-title">{g.categoria}</div>
            <div className="showcase-grid">
              {g.produtos.length === 0 ? (
                <div className="showcase-empty">Nenhum produto encontrado nessa categoria.</div>
              ) : (
                g.produtos.map((p) => (
                  <Link className="showcase-card" to={`/catalogo?produto=${encodeURIComponent(p.id)}`} key={p.id}>
                    <div className="photo"><img src={p.foto_local} alt="" loading="lazy" /></div>
                    <div className="marca">{p.marca}</div>
                    <div className="desc">{p.descricao}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Home() {
  const [categorias, setCategorias] = useState([]);
  const [showcaseGroups, setShowcaseGroups] = useState([]);
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  const [instaPosts, setInstaPosts] = useState(DEFAULT_INSTAGRAM_POSTS);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [contactSent, setContactSent] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contact, setContact] = useState({ nome: '', email: '', telefone: '', empresa: '', cnpj: '', mensagem: '' });

  useEffect(() => {
    supabase
      .from('produtos')
      .select('categoria')
      .eq('ativo', true)
      .limit(4000)
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        const unicas = [...new Set((data ?? []).map((p) => p.categoria).filter(Boolean))].sort();
        setCategorias(unicas);
      });
  }, []);

  useEffect(() => {
    supabase.from('conteudo_site').select('valor').eq('chave', 'banners').maybeSingle().then(({ data }) => {
      if (data?.valor?.length) setBanners(data.valor);
    });
    supabase.from('conteudo_site').select('valor').eq('chave', 'instagram').maybeSingle().then(({ data }) => {
      if (data?.valor?.length) setInstaPosts(data.valor);
    });
  }, []);

  useEffect(() => {
    supabase
      .from('conteudo_site')
      .select('valor')
      .eq('chave', 'destaques')
      .maybeSingle()
      .then(async ({ data }) => {
        const salvos = data?.valor ?? [];
        if (salvos.length === 0) {
          // Ainda não configurado no admin — usa a lista padrão de categorias como fallback.
          const cats = DEFAULT_DESTAQUE_CATEGORIAS.filter((c) => categorias.includes(c)).slice(0, 5);
          if (cats.length === 0) { setShowcaseGroups([]); return; }
          const groups = await Promise.all(
            cats.map((categoria) =>
              supabase
                .from('produtos')
                .select('id, marca, descricao, foto_local')
                .eq('ativo', true)
                .eq('categoria', categoria)
                .limit(3)
                .then(({ data: produtos }) => ({ categoria, produtos: produtos ?? [] }))
            )
          );
          setShowcaseGroups(groups);
          return;
        }

        const ids = salvos.flatMap((s) => s.produto_ids ?? []);
        const { data: produtos } = ids.length
          ? await supabase.from('produtos').select('id, marca, descricao, foto_local').in('id', ids).eq('ativo', true)
          : { data: [] };
        const byId = new Map((produtos ?? []).map((p) => [p.id, p]));
        setShowcaseGroups(
          salvos.map((s) => ({
            categoria: s.categoria,
            produtos: (s.produto_ids ?? []).map((id) => byId.get(id)).filter(Boolean),
          }))
        );
      });
  }, [categorias]);

  async function handleContactSubmit(e) {
    e.preventDefault();
    setContactError('');
    setContactSending(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar mensagem.');
      setContactSent(true);
      setContact({ nome: '', email: '', telefone: '', empresa: '', cnpj: '', mensagem: '' });
    } catch (err) {
      setContactError(err.message);
    } finally {
      setContactSending(false);
    }
  }

  return (
    <div>
      <Header />

      <div id="top" className="hero">
        <div className="eyebrow">Indústria de Auto Peças desde 1995</div>
        <h1>Peças de reposição de qualidade para todo o Brasil</h1>
        <p>Fechaduras, maçanetas, cilindros de ignição e muito mais — linha Leve, Pesada e Van, com o catálogo completo ao seu alcance.</p>
      </div>

      <div className="cta-block">
        <div className="cta-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#325387" strokeWidth="1.8">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>
        <div className="cta-text">
          <h3>Monte seu Catálogo</h3>
          <p>Selecione as peças que interessam pra você e exporte um catálogo em PDF, pronto para consultar e compartilhar.</p>
        </div>
        <Link className="cta-btn" to="/catalogo">Começar agora →</Link>
      </div>

      <TopBanner banners={banners} />

      <section id="categorias">
        <div className="wrap">
          <div className="eyebrow">O que você encontra na Ori</div>
          <h2>Categorias de produtos</h2>
          <div className="category-grid">
            {categorias.map((cat) => (
              <Link key={cat} className="category-chip" to={`/catalogo?categoria=${encodeURIComponent(cat)}`}>{cat}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="welcome" id="bem-vindo">
        <div className="wrap welcome-grid">
          <div>
            <div className="eyebrow">Quem somos</div>
            <h2>Seja bem-vindo à Ori</h2>
            <p>Atuando no mercado desde 1995, a Ori vem buscando soluções para atender as necessidades do setor de autopeças, com máxima tecnologia na execução de novos produtos.</p>
            <p>Estamos instalados em sede própria, com ferramentaria, estamparia, usinagem e injeção em Plástico, Zamac e Alumínio — garantindo qualidade e custo competitivo em cada peça produzida.</p>
            <div className="stats">
              <div className="stat"><b>30 anos</b><span>de mercado</span></div>
              <div className="stat"><b>3.515+</b><span>itens no catálogo</span></div>
              <div className="stat"><b>3</b><span>linhas: Leve, Pesada e Van</span></div>
            </div>
          </div>
          <div className="photo">
            <img src="/assets/stand-ori.png" alt="Ori na Feira Brasil" />
          </div>
        </div>
      </section>

      <section className="featured" id="destaque">
        <div className="wrap">
          <div className="eyebrow">Catálogo</div>
          <h2>Produtos em destaque</h2>
          <Showcase groups={showcaseGroups} />
        </div>
      </section>

      <section className="social">
        <div className="wrap">
          <div className="eyebrow">Acompanhe</div>
          <h2>Siga a Ori no Instagram</h2>
          <p className="social-sub">e mantenha-se informado sobre nossos lançamentos e participações em Feiras</p>
          <div className="social-icons">
            <a href="https://www.instagram.com/ori_industria/" target="_blank" rel="noopener" aria-label="Instagram">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" stroke="none" /></svg>
            </a>
          </div>
          <div className="insta-grid">
            {instaPosts.map((src) => (
              <button type="button" key={src} onClick={() => setLightboxSrc(src)}>
                <img src={src} alt="Post do Instagram da Ori" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {lightboxSrc && (
        <div className="home-lightbox open" onClick={() => setLightboxSrc(null)}>
          <button className="home-lightbox-close" onClick={() => setLightboxSrc(null)}>&times;</button>
          <img src={lightboxSrc} alt="" />
        </div>
      )}

      <section id="contato">
        <div className="wrap">
          <div className="eyebrow">Fale conosco</div>
          <h2>Envie sua mensagem</h2>
          <div className="contact-grid">
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <input type="text" placeholder="Nome*" required value={contact.nome} onChange={(e) => setContact({ ...contact, nome: e.target.value })} />
              <input type="email" placeholder="E-mail*" required value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              <input type="tel" placeholder="Telefone*" required value={contact.telefone} onChange={(e) => setContact({ ...contact, telefone: e.target.value })} />
              <input type="text" placeholder="Empresa" value={contact.empresa} onChange={(e) => setContact({ ...contact, empresa: e.target.value })} />
              <input type="text" placeholder="CNPJ" inputMode="numeric" value={contact.cnpj} onChange={(e) => setContact({ ...contact, cnpj: e.target.value })} />
              <textarea placeholder="Mensagem*" rows={4} required value={contact.mensagem} onChange={(e) => setContact({ ...contact, mensagem: e.target.value })} />
              <button type="submit" disabled={contactSending}>{contactSending ? 'Enviando...' : 'Enviar'}</button>
              {contactSent && <div className="contact-sent show">Mensagem enviada — retornaremos em breve.</div>}
              {contactError && <div className="contact-error">{contactError}</div>}
            </form>
            <div className="map-wrap">
              <div className="map-embed">
                <iframe
                  src="https://www.google.com/maps?q=Rua+Reverendo+Isaac+Silv%C3%A9rio+365,+Ermelino+Matarazzo,+S%C3%A3o+Paulo,+SP&output=embed"
                  loading="lazy"
                  allowFullScreen
                  title="Mapa Ori"
                />
              </div>
              <a
                className="map-link"
                href="https://www.google.com/maps/search/?api=1&query=Rua+Reverendo+Isaac+Silv%C3%A9rio+365%2C+Ermelino+Matarazzo%2C+S%C3%A3o+Paulo%2C+SP"
                target="_blank"
                rel="noopener"
              >
                Ver no Google Maps →
              </a>
            </div>
          </div>
          <div className="wrap" style={{ marginTop: 56 }}>
            <div className="eyebrow">Institucional</div>
            <h2>Endereço e contato</h2>
            <div className="info-grid">
              <div className="info-card">
                <h4>Ori Indústria de Auto Peças LTDA.</h4>
                <p>Rua Reverendo Isaac Silvério, 365/369<br />Ermelino Matarazzo, São Paulo, SP<br />CEP: 03810-030</p>
                <p style={{ marginTop: 8 }}><a href="tel:+551125425110">(11) 2542-5110</a></p>
              </div>
              <div className="info-card">
                <h4>Ori Truck Ind. de Auto Peças LTDA.</h4>
                <p>Rua Pascoal Rizzo, 25<br />Ermelino Matarazzo, São Paulo, SP<br />CEP: 03810-050</p>
                <p style={{ marginTop: 8 }}><a href="tel:+551125460671">(11) 2546-0671</a></p>
              </div>
              <div className="info-card">
                <h4>Catálogo completo</h4>
                <p>Monte o seu catálogo personalizado com as peças que você precisa e exporte em PDF na hora.</p>
                <p style={{ marginTop: 8 }}><Link to="/catalogo">Acessar catálogo →</Link></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <b>Ori Indústria de Auto Peças LTDA</b> — Todos os direitos reservados
      </footer>
    </div>
  );
}
