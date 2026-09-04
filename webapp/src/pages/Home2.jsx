import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { HeaderHome2 } from '../components/HeaderHome2';
import '../styles/home2.css';

const AUTOPLAY_MS = 5000;

const BENEFITS = [
  {
    title: 'Catálogo personalizado',
    description: 'Selecione os produtos que interessam ao seu negócio e gere um PDF pronto para consultar, apresentar e compartilhar.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path d="M15 3v5h5" />
        <line x1="9" y1="16" x2="15" y2="16" />
        <line x1="9" y1="12" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    title: 'Busca por código e referência',
    description: 'Encontre rapidamente por código Ori, referência original, descrição ou termo técnico.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    title: 'Aplicações por veículo e marca',
    description: 'Navegue pelas aplicações compatíveis e encontre a peça certa para cada veículo.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13l1.5-5A2 2 0 0 1 6.4 6.5h11.2a2 2 0 0 1 1.9 1.5L21 13" />
        <rect x="3" y="13" width="18" height="5" rx="1.5" />
        <circle cx="7.5" cy="18.5" r="1.5" />
        <circle cx="16.5" cy="18.5" r="1.5" />
      </svg>
    ),
  },
  {
    title: 'Catálogo sempre atualizado',
    description: 'Produtos, imagens, códigos e aplicações mantidos em uma base centralizada e atualizada pela Ori.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    ),
  },
  {
    title: 'Linhas, marcas e categorias',
    description: 'Explore o portfólio organizado de forma lógica para localizar produtos com poucos cliques.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 3 21 8 12 13 3 8 12 3" />
        <polyline points="3 14 12 19 21 14" />
      </svg>
    ),
  },
  {
    title: 'Conteúdo técnico do produto',
    description: 'Consulte informações, referências e materiais disponíveis diretamente em cada item do catálogo.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="3" width="12" height="18" rx="1.5" />
        <path d="M9 3v2h6V3" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
];

function BenefitsHome2() {
  return (
    <section className="home2-benefits">
      <div className="home2-container">
        <div className="home2-benefits-header">
          <div className="home2-section-eyebrow">O QUE A ORI TE ENTREGA</div>
          <h2>Tudo o que você precisa para encontrar e apresentar o produto certo</h2>
          <p>Uma experiência digital criada para tornar a consulta ao portfólio Ori mais rápida, organizada e prática.</p>
        </div>

        <div className="home2-benefits-grid">
          {BENEFITS.map((benefit) => (
            <div className="home2-benefit-card" key={benefit.title}>
              <div className="home2-benefit-icon">{benefit.icon}</div>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BannersHome2({ banners }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const goTo = (i) => setIndex((i + banners.length) % banners.length);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    timerRef.current = setInterval(() => goTo(index + 1), AUTOPLAY_MS);
    return () => clearInterval(timerRef.current);
  }, [index, banners.length]);

  if (banners.length === 0) return null;

  const isCarousel = banners.length > 1;

  return (
    <section className="home2-banners">
      <div className="home2-container">
        <div
          className="home2-banners-frame"
          onMouseEnter={() => clearInterval(timerRef.current)}
          onMouseLeave={() => { if (isCarousel) timerRef.current = setInterval(() => goTo(index + 1), AUTOPLAY_MS); }}
        >
          <div className="home2-banners-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {banners.map((src) => (
              <div className="home2-banners-slide" key={src}>
                <img src={src} alt="Banner Ori" loading="lazy" />
              </div>
            ))}
          </div>

          {isCarousel && (
            <>
              <button type="button" className="home2-banners-nav home2-banners-prev" onClick={() => goTo(index - 1)} aria-label="Banner anterior">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button type="button" className="home2-banners-nav home2-banners-next" onClick={() => goTo(index + 1)} aria-label="Próximo banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </>
          )}
        </div>

        {isCarousel && (
          <div className="home2-banners-dots">
            {banners.map((_, i) => (
              <button key={i} type="button" className={`home2-banners-dot ${i === index ? 'active' : ''}`} onClick={() => goTo(i)} aria-label={`Ir para banner ${i + 1}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CategoriesHome2({ groups }) {
  return (
    <section className="home2-categories" id="categorias">
      <div className="home2-container">
        <div className="home2-categories-header">
          <div className="home2-section-eyebrow">CATEGORIAS</div>

          <h2>Encontre o que precisa por categoria</h2>

          <p>
            Navegue pelas principais categorias do portfólio Ori e encontre os
            produtos certos com mais rapidez.
          </p>
        </div>

        <div className="home2-categories-grid">
          {groups.slice(0, 5).map((group) => (
            <Link
              key={group.categoria}
              to={`/catalogo?categoria=${encodeURIComponent(group.categoria)}`}
              className="home2-category-card"
            >
              <div className="home2-category-card-content">
                <span className="home2-category-card-title">
                  {group.categoria}
                </span>

                <span className="home2-category-card-arrow" aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          ))}

          <Link
            to="/catalogo"
            className="home2-category-card home2-category-card-all"
          >
            <div className="home2-category-card-content">
              <span className="home2-category-card-title">Ver todas</span>

              <span className="home2-category-card-arrow" aria-hidden="true">
                →
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ShowcaseHome2({ groups }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (groups.length <= 1) return undefined;

    timerRef.current = setInterval(() => {
      setActive((current) => (current + 1) % groups.length);
    }, 5000);

    return () => clearInterval(timerRef.current);
  }, [groups.length]);

  if (!groups.length) return null;

  return (
    <section className="home2-featured" id="destaques">
      <div className="home2-container">
        <div className="home2-featured-header">
          <div className="home2-section-eyebrow">CATÁLOGO</div>
          <h2>Produtos em destaque</h2>
        </div>

        <div
          className="home2-showcase"
          onMouseEnter={() => clearInterval(timerRef.current)}
          onMouseLeave={() => {
            if (groups.length > 1) {
              timerRef.current = setInterval(() => {
                setActive((current) => (current + 1) % groups.length);
              }, 5000);
            }
          }}
        >
          {groups.map((group, index) => (
            <div
              key={group.categoria}
              className={`home2-showcase-item ${
                index === active ? 'active' : ''
              }`}
            >
              <button
                type="button"
                className="home2-showcase-collapsed"
                onClick={() => setActive(index)}
              >
                <span>{group.categoria}</span>
              </button>

              <div className="home2-showcase-expanded">
                <div className="home2-showcase-expanded-title">
                  {group.categoria}
                </div>

                <div className="home2-showcase-grid">
                  {group.produtos.map((produto) => (
                    <Link
                      key={produto.id}
                      className="home2-showcase-card"
                      to={`/catalogo?produto=${encodeURIComponent(produto.id)}`}
                    >
                      <div className="home2-showcase-photo">
                        <img
                          src={produto.foto_local}
                          alt={produto.descricao}
                          loading="lazy"
                        />
                      </div>

                      <div className="home2-showcase-code">
                        {produto.codigo}
                      </div>

                      <div className="home2-showcase-brand">
                        {produto.marca}
                      </div>

                      <div className="home2-showcase-description">
                        {produto.descricao}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InstagramHome2({ posts }) {
  const postsRef = useRef(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const lightboxOpen = lightboxIndex !== null;

  const showPrevious = () => {
    setLightboxIndex((current) =>
      current === null
        ? null
        : (current - 1 + posts.length) % posts.length
    );
  };

  const showNext = () => {
    setLightboxIndex((current) =>
      current === null
        ? null
        : (current + 1) % posts.length
    );
  };

  const movePosts = (direction) => {
    postsRef.current?.scrollBy({
      left: direction * 232,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    if (!lightboxOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setLightboxIndex(null);
      }

      if (event.key === 'ArrowLeft') {
        showPrevious();
      }

      if (event.key === 'ArrowRight') {
        showNext();
      }
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxOpen, posts.length]);

  if (!posts.length) return null;

  return (
    <section className="home2-instagram">
      <div className="home2-container home2-instagram-inner">

        <div className="home2-instagram-copy">
          <div className="home2-section-eyebrow">
            LANÇAMENTOS E NOVIDADES
          </div>

          <h2>Fique por dentro das novidades e lançamentos</h2>

          <p>
            Acompanhe lançamentos, campanhas e conteúdos exclusivos da Ori
            e mantenha sua equipe e seus clientes sempre atualizados.
          </p>

          <a
            className="home2-instagram-cta"
            href="https://www.instagram.com/ori_industria/"
            target="_blank"
            rel="noopener noreferrer"
          >
            SEGUIR NO INSTAGRAM
          </a>
        </div>

        <div className="home2-instagram-carousel">
          <button
            type="button"
            className="home2-instagram-nav home2-instagram-prev"
            aria-label="Publicações anteriores"
            onClick={() => movePosts(-1)}
          >
            ‹
          </button>

          <div className="home2-instagram-posts" ref={postsRef}>
            {posts.map((src, index) => (
              <button
                type="button"
                className="home2-instagram-card"
                key={`${src}-${index}`}
                aria-label={`Abrir publicação ${index + 1}`}
                onClick={() => setLightboxIndex(index)}
              >
                <img
                  src={src}
                  alt={`Publicação da Ori ${index + 1}`}
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            className="home2-instagram-nav home2-instagram-next"
            aria-label="Próximas publicações"
            onClick={() => movePosts(1)}
          >
            ›
          </button>
        </div>

            </div>

      {lightboxOpen && (
        <div
          className="home2-instagram-lightbox"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setLightboxIndex(null);
            }
          }}
        >
          <button
            type="button"
            className="home2-instagram-lightbox-close"
            onClick={() => setLightboxIndex(null)}
            aria-label="Fechar"
          >
            ×
          </button>

          {posts.length > 1 && (
            <button
              type="button"
              className="home2-instagram-lightbox-nav is-prev"
              onClick={showPrevious}
              aria-label="Imagem anterior"
            >
              ‹
            </button>
          )}

          <div className="home2-instagram-lightbox-content">
            <img
              src={posts[lightboxIndex]}
              alt={`Publicação da Ori ${lightboxIndex + 1}`}
            />

            <div className="home2-instagram-lightbox-counter">
              {lightboxIndex + 1} / {posts.length}
            </div>
          </div>

          {posts.length > 1 && (
            <button
              type="button"
              className="home2-instagram-lightbox-nav is-next"
              onClick={showNext}
              aria-label="Próxima imagem"
            >
              ›
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function Home2() {
  const [banners, setBanners] = useState([]);
  const [showcaseGroups, setShowcaseGroups] = useState([]);
  const [instagramPosts, setInstagramPosts] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [contactSent, setContactSent] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactError, setContactError] = useState('');

  const [contact, setContact] = useState({
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    cnpj: '',
    mensagem: '',
  });

  async function handleContactSubmit(e) {
    e.preventDefault();

    setContactError('');
    setContactSending(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contact),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao enviar mensagem.');
      }

      setContactSent(true);

      setContact({
        nome: '',
        email: '',
        telefone: '',
        empresa: '',
        cnpj: '',
        mensagem: '',
      });
    } catch (err) {
      setContactError(err.message);
    } finally {
      setContactSending(false);
    }
  }

  useEffect(() => {
    supabase
      .from('produtos')
      .select('categoria')
      .eq('ativo', true)
      .limit(4000)
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          return;
        }

        const unicas = [
          ...new Set((data ?? []).map((p) => p.categoria).filter(Boolean)),
        ].sort();

        setCategorias(unicas);
      });
  }, []);

  useEffect(() => {
    supabase.from('conteudo_site').select('valor').eq('chave', 'banners').maybeSingle().then(({ data }) => {
      setBanners(data?.valor ?? []);
    });
  }, []);

  useEffect(() => {
    supabase
      .from('conteudo_site')
      .select('valor')
      .eq('chave', 'instagram')
      .maybeSingle()
      .then(({ data }) => {
        setInstagramPosts(data?.valor ?? []);
      });
  }, []);

  useEffect(() => {
  supabase    .from('conteudo_site').select('valor').eq('chave', 'destaques').maybeSingle().then(async ({ data }) => {
      const salvos = data?.valor ?? [];

      if (salvos.length === 0) {
        setShowcaseGroups([]);
        return;
      }

      const ids = salvos.flatMap((item) => item.produto_ids ?? []);

      const { data: produtos } = ids.length
        ? await supabase
            .from('produtos')
            .select('id, codigo, marca, descricao, foto_local')
            .in('id', ids)
            .eq('ativo', true)
        : { data: [] };

      const byId = new Map(
        (produtos ?? []).map((produto) => [produto.id, produto])
      );

      setShowcaseGroups(
        salvos.map((item) => ({
          categoria: item.categoria,
          produtos: (item.produto_ids ?? [])
            .map((id) => byId.get(id))
            .filter(Boolean),
        }))
      );
    });
}, []);

  return (
    <div className="home2-page">
      <HeaderHome2 />

      <section className="home2-hero">
        <div className="home2-container home2-hero-inner">
          <div className="home2-hero-copy">
            <h1>
              Encontre as peças certas e monte seu{' '}
              <span className="home2-hero-highlight">catálogo em minutos</span>
            </h1>
            <p className="home2-hero-subtitle">
              Pesquise por código, aplicação, veículo ou marca, selecione os produtos ideais e gere um catálogo personalizado pronto para consultar, apresentar e compartilhar.
            </p>

            <div className="home2-hero-stats">
              <div className="home2-stat">
                <span className="home2-stat-value">+3500</span>
                <span className="home2-stat-label">SKUs</span>
              </div>
              <div className="home2-stat">
                <span className="home2-stat-value">+3.600</span>
                <span className="home2-stat-label">aplicações</span>
              </div>
              <div className="home2-stat">
                <span className="home2-stat-value">+380</span>
                <span className="home2-stat-label">Veículos distintos</span>
              </div>
              <div className="home2-stat">
                <span className="home2-stat-value">PDFs</span>
                <span className="home2-stat-label">personalizados</span>
              </div>
            </div>

            <div className="home2-hero-ctas">
              <Link className="home2-btn-primary" to="/catalogo">MONTAR MEU CATÁLOGO</Link>
            </div>
          </div>

          <div className="home2-hero-visual">
            <img src="/assets/home2/hero-macbook.png" alt="Aplicativo Ori exibido em notebook" />
          </div>
        </div>
      </section>

      <BannersHome2 banners={banners} />

      <CategoriesHome2 groups={showcaseGroups}/>

      <section className="home2-about" id="a-ori">
        <div className="home2-container home2-about-grid">
          <div className="home2-about-media">
            <img
              src="/assets/ori-feira.png"
              alt="Ori em evento do setor automotivo"
              loading="lazy"
            />
          </div>

          <div className="home2-about-copy">
            <div className="home2-section-eyebrow">A ORI</div>

            <h2>Tradição, presença e experiência no mercado automotivo</h2>

            <p>
              Desde 1995, a Ori atua no mercado de autopeças desenvolvendo um
              portfólio amplo para atender distribuidores, lojistas, oficinas e
              profissionais do setor automotivo.
            </p>

            <p>
              Ao longo dessa trajetória, a empresa construiu relações duradouras com
              seus clientes, acompanhando de perto as necessidades do mercado e a
              evolução das aplicações automotivas.
            </p>
          </div>
        </div>
</section>

      <BenefitsHome2 />

      <section className="home2-catalog-showcase">
        <div className="home2-container home2-catalog-showcase-inner">
          <div className="home2-catalog-showcase-visual">
            <img
              src="/assets/home2/catalog-showcase.png"
              alt="Catálogo Ori com busca e filtros"
            />
          </div>

          <div className="home2-catalog-showcase-copy">
            <div className="home2-section-eyebrow">CATÁLOGO COMPLETO E ORGANIZADO</div>

            <h2>Encontre, filtre e apresente com agilidade</h2>

            <p className="home2-catalog-showcase-text">
              Consulte milhares de produtos, encontre aplicações, refine sua busca
              e acesse as informações que precisa de forma rápida e organizada.
            </p>

            <ul className="home2-catalog-showcase-list">
              <li>Busca por código, referência, descrição, veículo ou marca</li>
              <li>Filtros por linha, categoria e montadora</li>
              <li>Produtos com códigos e informações organizadas</li>
              <li>Seleção rápida para montar seu catálogo personalizado</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="home2-catalog-steps">
        <div className="home2-container">
          <div className="home2-catalog-steps-header">
            <div className="home2-section-eyebrow">
              MONTE SEU CATÁLOGO EM 4 PASSOS
            </div>

            <h2>Crie seu catálogo personalizado em minutos</h2>

            <p>
              Escolha os produtos que precisa e gere um material organizado,
              pronto para consultar, apresentar e compartilhar.
            </p>
          </div>

          <div className="home2-catalog-steps-grid">

            <article className="home2-catalog-step">
              <span className="home2-catalog-step-number">1</span>

              <div className="home2-catalog-step-visual">
                <svg
                  width="54"
                  height="54"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="7" height="7" rx="1" />
                  <rect x="14" y="4" width="7" height="7" rx="1" />
                  <rect x="3" y="15" width="7" height="6" rx="1" />
                  <path d="M15 18l2 2 4-5" />
                </svg>
              </div>

              <h3>Selecione os produtos</h3>

              <p>
                Busque e adicione os produtos que deseja incluir no catálogo.
              </p>
            </article>

            <article className="home2-catalog-step">
              <span className="home2-catalog-step-number">2</span>

              <div className="home2-catalog-step-visual">
                <svg
                  width="54"
                  height="54"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 5h11" />
                  <path d="M9 12h11" />
                  <path d="M9 19h11" />
                  <path d="M3 5l1.5 1.5L7 3.5" />
                  <path d="M3 12l1.5 1.5L7 10.5" />
                  <path d="M3 19l1.5 1.5L7 17.5" />
                </svg>
              </div>

              <h3>Revise sua seleção</h3>

              <p>
                Confira os itens escolhidos e ajuste sua seleção antes de gerar o material.
              </p>
            </article>

            <article className="home2-catalog-step">
              <span className="home2-catalog-step-number">3</span>

              <div className="home2-catalog-step-visual">
                <svg
                  width="54"
                  height="54"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16v16H4z" />
                  <path d="M8 8h8" />
                  <path d="M8 12h5" />
                  <path d="M8 16h8" />
                </svg>
              </div>

              <h3>Organize seu catálogo</h3>

              <p>
                Os produtos são organizados para uma apresentação clara e padronizada.
              </p>
            </article>

            <article className="home2-catalog-step">
              <span className="home2-catalog-step-number">4</span>

              <div className="home2-catalog-step-visual">
                <svg
                  width="54"
                  height="54"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2h9l5 5v15H6z" />
                  <path d="M15 2v5h5" />
                  <path d="M9 14h6" />
                  <path d="M12 11v6" />
                </svg>
              </div>

              <h3>Gere seu PDF</h3>

              <p>
                Baixe seu catálogo personalizado pronto para consultar, apresentar ou compartilhar.
              </p>
            </article>

          </div>
        </div>
      </section>
      
      <ShowcaseHome2 groups={showcaseGroups} />
      <InstagramHome2 posts={instagramPosts} />

      <section className="home2-contact" id="contato">
        <div className="home2-container">
          <div className="home2-contact-header">
            <div className="home2-section-eyebrow">FALE CONOSCO</div>
            <h2>Como podemos ajudar?</h2>
            <p>
              Envie sua mensagem para a equipe Ori e retornaremos o contato.
            </p>
          </div>

          <div className="home2-contact-grid">
            <form className="home2-contact-form" onSubmit={handleContactSubmit}>
              <div className="home2-contact-row">
                <input type="text" placeholder="Nome*" value={contact.nome}onChange={(e) => setContact({ ...contact, nome: e.target.value })}required />
                <input type="email" placeholder="E-mail*" value={contact.email}onChange={(e) => setContact({ ...contact, email: e.target.value })} required />
              </div>

              <div className="home2-contact-row">
                <input type="tel" placeholder="Telefone*" value={contact.telefone}onChange={(e) => setContact({ ...contact, telefone: e.target.value })} required />
                <input type="text" placeholder="Empresa" value={contact.empresa}onChange={(e) => setContact({ ...contact, empresa: e.target.value })}/>
              </div>

              <input type="text" placeholder="CNPJ" value={contact.cnpj}onChange={(e) => setContact({ ...contact, cnpj: e.target.value })}/>

              <textarea
                placeholder="Mensagem*" rows="5" value={contact.mensagem}onChange={(e) => setContact({ ...contact, mensagem: e.target.value })}
                required
              />

              <button type="submit" disabled={contactSending}>
                {contactSending ? 'ENVIANDO...' : 'ENVIAR MENSAGEM'}
              </button>
                {contactSent && (
                  <p className="home2-contact-success">
                    Mensagem enviada com sucesso. Em breve entraremos em contato.
                  </p>
                )}

                {contactError && (
                  <p className="home2-contact-error">
                    {contactError}
                  </p>
                )}
            </form>

            <div className="home2-contact-map">
              <div className="home2-contact-map-frame">
                <iframe
                  src="https://www.google.com/maps?q=Rua+Reverendo+Isaac+Silv%C3%A9rio+365,+Ermelino+Matarazzo,+S%C3%A3o+Paulo,+SP&output=embed"
                  loading="lazy"
                  allowFullScreen
                  title="Mapa Ori"
                  style={{ width: '100%', height: '348px', border: 0 }}
                />
              </div>

              <a
                className="home2-contact-map-link"
                href="https://www.google.com/maps/search/?api=1&query=Rua+Reverendo+Isaac+Silv%C3%A9rio+365%2C+Ermelino+Matarazzo%2C+S%C3%A3o+Paulo%2C+SP"
                target="_blank"
                rel="noopener noreferrer"
              >
                
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="home2-final-cta">
        <div className="home2-container home2-locations-grid">
          <div className="home2-locations-icon">
            <div className="home2-final-cta-icon">
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
                <path d="M4 13h3v6H5a1 1 0 0 1-1-1z" />
                <path d="M20 13h-3v6h2a1 1 0 0 0 1-1z" />
                <path d="M17 19c0 1.1-.9 2-2 2h-3" />
              </svg>
            </div>
          </div>

          <div className="home2-locations-copy">
            <h2>Pronto para transformar sua operação comercial?</h2>

            <p>
              Fale com nossa equipe e descubra como a Ori pode ajudar sua empresa
              a consultar, apresentar e compartilhar produtos com mais agilidade.
            </p>
          </div>

          <div className="home2-location-card">
            <span className="home2-location-label">
              ORI INDÚSTRIA DE AUTO PEÇAS LTDA.
            </span>

            <p>
              Rua Reverendo Isaac Silvério, 365/369
              <br />
              Ermelino Matarazzo — São Paulo/SP
              <br />
              CEP 03810-030
            </p>

            <a href="tel:+551125425110" className="home2-location-phone">
              (11) 2542-5110
            </a>
          </div>

          <div className="home2-location-card">
            <span className="home2-location-label">
              ORI TRUCK IND. DE AUTO PEÇAS LTDA.
            </span>

            <p>
              Rua Pascoal Rizzo, 25
              <br />
              Ermelino Matarazzo — São Paulo/SP
              <br />
              CEP 03810-050
            </p>

            <a href="tel:+551125460671" className="home2-location-phone">
              (11) 2546-0671
            </a>
          </div>
        </div>
      </section>

      <footer className="home2-footer">
        <div className="home2-container home2-footer-grid">

          <div className="home2-footer-brand">
            <img src="/assets/logo.png" alt="Ori" />

            <p>
              Indústria de autopeças desde 1995, desenvolvendo soluções inteligentes
              para o mercado automotivo.
            </p>
          </div>

          <div className="home2-footer-column">
            <h3>NAVEGAÇÃO</h3>

            <a href="/#top">A Ori</a>
            <a href="/#categorias">Categorias</a>
            <a href="/#destaques">Destaques</a>
            <a href="/#contato">Contato</a>
          </div>

          <div className="home2-footer-column">
            <h3>CATÁLOGO</h3>

            <Link to="/catalogo">Todos os produtos</Link>
            <Link to="/catalogo">Linhas e categorias</Link>
          </div>

          <div className="home2-footer-column">
            <h3>SUPORTE</h3>

            <a href="#contato">Fale conosco</a>
            <a href="#contato">Central de atendimento</a>
          </div>

          <div className="home2-footer-column home2-footer-contact">
            <h3>CONTATO</h3>

            <a href="tel:+551125425110">(11) 2542-5110</a>
            <a href="tel:+551125460671">(11) 2546-0671</a>

            <a href="#contato">Fale com a equipe Ori</a>
          </div>

        </div>

        <div className="home2-footer-bottom">
          <div className="home2-container">
            © 2026 Ori Indústria de Auto Peças. Todos os direitos reservados. Desenvolvido por Spinelli Web
          </div>
        </div>
      </footer>
    
    </div>
  );
}
