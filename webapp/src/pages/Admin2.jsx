import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { LeadsSection } from '../components/admin2/LeadsSection';
import { OverviewSection } from '../components/admin2/OverviewSection';
import '../styles/admin2.css';

const ADMIN2_LINES = ['Leve', 'Van', 'Pesada'];

const ADMIN2_MAX_HIGHLIGHT_CATEGORIES = 5;
const ADMIN2_MAX_HIGHLIGHT_PRODUCTS = 3;

function emptyAdmin2HighlightSlot() {
  return {
    categoria: '',
    produtoIds: [],
    produtos: [],
  };
}

function emptyAdmin2Application() {
  return {
    veiculo: '',
    geracao: '',
    portas: '',
    ano_apos: '',
    ate: '',
    obs: '',
  };
}

async function uploadAdmin2ProductPhoto(session, file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'produtos');

  const response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Falha no upload da imagem.');
  }

  return data.url;
}

async function uploadAdmin2ContentImage(session, file, folder) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Falha no upload da imagem.');
  }

  return data.url;
}

const NAV_ITEMS = [
  { key: 'overview', label: 'Visão geral' },

  { section: 'PRODUTOS' },
  { key: 'products', label: 'Produtos' },
  { key: 'categories', label: 'Categorias' },

  { section: 'CONTEÚDO' },
  { key: 'highlights', label: 'Destaques' },
  { key: 'banners', label: 'Banners' },
  { key: 'instagram', label: 'Instagram' },

  { section: 'COMERCIAL' },
  { key: 'users', label: 'Usuários' },
  { key: 'selections', label: 'Seleções salvas' },
  { key: 'leads', label: 'Leads' },
];

const SECTION_META = {
  overview: {
    title: 'Visão geral',
    subtitle: 'Acompanhe os principais dados e atividades do aplicativo.',
  },
  products: {
    title: 'Produtos',
    subtitle: 'Gerencie o catálogo e os dados dos produtos.',
  },
  categories: {
    title: 'Categorias',
    subtitle: 'Organize a estrutura de categorias do catálogo.',
  },
  highlights: {
    title: 'Destaques',
    subtitle: 'Defina os produtos exibidos em destaque no site.',
  },
  banners: {
    title: 'Banners',
    subtitle: 'Gerencie os banners da página inicial.',
  },
  instagram: {
    title: 'Instagram',
    subtitle: 'Gerencie as imagens da seção de Instagram.',
  },
  users: {
    title: 'Usuários',
    subtitle: 'Gerencie administradores, representantes e clientes.',
  },
  selections: {
    title: 'Seleções salvas',
    subtitle: 'Consulte as seleções de catálogo salvas por usuários.',
  },
  leads: {
    title: 'Leads',
    subtitle: 'Acompanhe os usuários e contatos capturados pelo aplicativo.',
  },
};


function Admin2ProductEditModal({
  produto,
  marcas,
  categorias,
  session,
  onClose,
  onSaved,
}) {
  const isEdit = !!produto?.id;
  const [codigo, setCodigo] = useState(produto.codigo ?? '');
  const [original, setOriginal] = useState(produto.original ?? '');
  const [numeroConversao, setNumeroConversao] = useState(
    produto.numero_conversao ?? ''
  );
  const [marca, setMarca] = useState(produto.marca ?? '');
  const [categoria, setCategoria] = useState(produto.categoria ?? '');
  const [descricao, setDescricao] = useState(produto.descricao ?? '');
  const [pesoLiquido, setPesoLiquido] = useState(produto.peso_liquido ?? '');
  const [barras, setBarras] = useState(produto.barras ?? '');

  const [linhas, setLinhas] = useState(
    produto.linha
      ? produto.linha
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : []
  );

  const [aplicacoes, setAplicacoes] = useState(
    Array.isArray(produto.aplicacoes) && produto.aplicacoes.length
      ? produto.aplicacoes.map((aplicacao) => ({
          veiculo: aplicacao.veiculo ?? '',
          geracao: aplicacao.geracao ?? '',
          portas: aplicacao.portas ?? '',
          ano_apos: aplicacao.ano_apos ?? '',
          ate: aplicacao.ate ?? '',
          obs: aplicacao.obs ?? '',
        }))
      : [emptyAdmin2Application()]
  );

  const [fotoAtual, setFotoAtual] = useState(
    produto.foto_local || produto.foto_local_gde || ''
  );
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(
    produto.foto_local || produto.foto_local_gde || ''
  );

  const [galeria, setGaleria] = useState(
    Array.isArray(produto.galeria) ? produto.galeria : []
  );

  const [galleryUploading, setGalleryUploading] = useState(false);
  const [gallerySaving, setGallerySaving] = useState(false);
  const [galleryManagerOpen, setGalleryManagerOpen] = useState(false);

  const [baseUpdatedAt, setBaseUpdatedAt] = useState(
    produto.updated_at ?? null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateApplication(index, field, value) {
    setAplicacoes((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  }

  function addApplication() {
    setAplicacoes((rows) => [...rows, emptyAdmin2Application()]);
  }

  function removeApplication(index) {
    setAplicacoes((rows) => {
      const next = rows.filter((_, rowIndex) => rowIndex !== index);
      return next.length ? next : [emptyAdmin2Application()];
    });
  }

  function toggleLine(line) {
    setLinhas((current) =>
      current.includes(line)
        ? current.filter((item) => item !== line)
        : [...current, line]
    );
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  async function persistGalleryChanges({
    nextGallery,
    nextMainPhoto,
  }) {
    const payload = {
      galeria: nextGallery,
    };

    if (nextMainPhoto !== undefined) {
      payload.foto_local = nextMainPhoto || null;
      payload.foto_local_gde = nextMainPhoto || null;
    }

    const { data, error: updateError } = await supabase
      .from('produtos')
      .update(payload)
      .eq('id', produto.id)
      .eq('updated_at', baseUpdatedAt)
      .select('*')
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!data) {
      throw new Error(
        'Este produto foi alterado por outro administrador. Feche a edição e abra novamente antes de continuar.'
      );
    }

    setGaleria(Array.isArray(data.galeria) ? data.galeria : []);
    setBaseUpdatedAt(data.updated_at);

    if (nextMainPhoto !== undefined) {
      const savedMainPhoto =
        data.foto_local || data.foto_local_gde || '';

      setFotoAtual(savedMainPhoto);
      setFotoPreview(savedMainPhoto);
      setFotoFile(null);
    }

    return data;
  }

  async function handleGalleryAdd(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    setGalleryUploading(true);
    setError('');

    try {
      // NOVO PRODUTO:
      // ainda não existe registro no banco.
      // Mantemos os arquivos apenas localmente até "Salvar produto".
      if (!isEdit) {
        const pendingImages = files.map((file) => {
          const previewUrl = URL.createObjectURL(file);

          return {
            peq: previewUrl,
            gde: previewUrl,
            pendingFile: file,
          };
        });

        setGaleria((current) => [
          ...current,
          ...pendingImages,
        ]);

        return;
      }

      // PRODUTO EXISTENTE:
      // upload + persistência imediata da galeria.
      const uploadedImages = [];

      for (const file of files) {
        const url = await uploadAdmin2ProductPhoto(
          session,
          file
        );

        uploadedImages.push({
          peq: url,
          gde: url,
        });
      }

      const nextGallery = [
        ...galeria,
        ...uploadedImages,
      ];

      await persistGalleryChanges({
        nextGallery,
      });
    } catch (err) {
      setError(
        err.message ||
          'Não foi possível adicionar a imagem.'
      );
    } finally {
      setGalleryUploading(false);
      event.target.value = '';
    }
  }

  async function removeGalleryImage(index) {
    const confirmed = window.confirm(
      'Remover esta imagem da galeria?'
    );

    if (!confirmed) return;

    if (!isEdit) {
      setGaleria((current) =>
        current.filter(
          (_, imageIndex) => imageIndex !== index
        )
      );
      return;
    }

    setGallerySaving(true);
    setError('');

    try {
      const nextGallery = galeria.filter(
        (_, imageIndex) => imageIndex !== index
      );

      await persistGalleryChanges({
        nextGallery,
      });
    } catch (err) {
      setError(
        err.message ||
          'Não foi possível remover a imagem.'
      );
    } finally {
      setGallerySaving(false);
    }
  }

  async function setGalleryImageAsMain(index) {
    const image = galeria[index];

    if (!image) return;

    const newMainImage =
      image.gde || image.peq || '';

    if (!newMainImage) return;

    if (!isEdit) {
      const remaining = galeria.filter(
        (_, imageIndex) => imageIndex !== index
      );

      if (image.pendingFile) {
        setFotoFile(image.pendingFile);
        setFotoPreview(newMainImage);
      } else {
        setFotoAtual(newMainImage);
        setFotoPreview(newMainImage);
      }

      setGaleria(remaining);
      return;
    }

    setGallerySaving(true);
    setError('');

    try {
      const oldMainImage = fotoAtual;

      const remaining = galeria.filter(
        (_, imageIndex) => imageIndex !== index
      );

      const nextGallery = oldMainImage
        ? [
            {
              peq: oldMainImage,
              gde: oldMainImage,
            },
            ...remaining,
          ]
        : remaining;

      await persistGalleryChanges({
        nextGallery,
        nextMainPhoto: newMainImage,
      });
    } catch (err) {
      setError(
        err.message ||
          'Não foi possível definir a imagem principal.'
      );
    } finally {
      setGallerySaving(false);
    }
  }



  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (
      !codigo.trim() ||
      !marca.trim() ||
      !categoria.trim() ||
      !descricao.trim()
    ) {
      setError(
        'Código, marca, categoria e descrição são obrigatórios.'
      );
      return;
    }

    setSaving(true);

    try {
      let finalPhotoUrl = fotoAtual;

      if (fotoFile) {
        finalPhotoUrl =
          await uploadAdmin2ProductPhoto(
            session,
            fotoFile
          );
      }

      const cleanedApplications = aplicacoes
        .map((application) => ({
          veiculo: String(
            application.veiculo ?? ''
          ).trim(),
          geracao: String(
            application.geracao ?? ''
          ).trim(),
          portas: String(
            application.portas ?? ''
          ).trim(),
          ano_apos: String(
            application.ano_apos ?? ''
          ).trim(),
          ate: String(
            application.ate ?? ''
          ).trim(),
          obs: String(
            application.obs ?? ''
          ).trim(),
        }))
        .filter((application) =>
          Object.values(application).some(
            (value) => value !== ''
          )
        );

      let finalGallery = galeria;

      if (!isEdit) {
        finalGallery = [];

        for (const image of galeria) {
          if (image.pendingFile) {
            const url =
              await uploadAdmin2ProductPhoto(
                session,
                image.pendingFile
              );

            finalGallery.push({
              peq: url,
              gde: url,
            });
          } else {
            finalGallery.push({
              peq: image.peq || image.gde || '',
              gde: image.gde || image.peq || '',
            });
          }
        }
      }

      const payload = {
        codigo: codigo.trim(),
        original: original.trim() || null,
        numero_conversao:
          numeroConversao.trim() || null,
        marca: marca.trim(),
        categoria: categoria.trim(),
        descricao: descricao.trim(),
        peso_liquido:
          pesoLiquido.trim() || null,
        barras: barras.trim() || null,
        linha: linhas.join(', ') || null,
        aplicacoes: cleanedApplications,
        foto_local: finalPhotoUrl || null,
        foto_local_gde: finalPhotoUrl || null,
      };

      if (!isEdit) {
        const { data, error: insertError } =
          await supabase
            .from('produtos')
            .insert({
              ...payload,
              galeria: finalGallery,
              ativo: true,
              aplicacao_revisar: false,
            })
            .select('*')
            .single();

        if (insertError) {
          throw insertError;
        }

        onSaved(data);
        return;
      }

      const { data, error: updateError } =
        await supabase
          .from('produtos')
          .update(payload)
          .eq('id', produto.id)
          .eq('updated_at', baseUpdatedAt)
          .select('*')
          .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (!data) {
        setError(
          'Este produto foi alterado por outro administrador enquanto você estava editando. Feche esta janela, localize o produto novamente e revise a versão mais recente antes de salvar.'
        );
        return;
      }

      setFotoAtual(finalPhotoUrl);
      onSaved(data);
    } catch (err) {
      setError(
        err.message ||
          'Não foi possível salvar o produto.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="admin2-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="admin2-product-modal">
        <div className="admin2-modal-header">
          <div>
            <h2>
              {isEdit ? 'Editar produto' : 'Novo produto'}
            </h2>

            <p>
              {isEdit
                ? `Cód. ${produto.codigo}`
                : 'Cadastre um novo item no catálogo.'}
            </p>
          </div>

          <button
            type="button"
            className="admin2-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin2-modal-scroll">
            <section className="admin2-form-section">
              <h3>Produto</h3>

              <div className="admin2-media-row">
                <div className="admin2-media-group">
                  <div className="admin2-media-label">Imagem principal</div>

                  <div className="admin2-media-content">
                    <div className="admin2-edit-photo">
                      {fotoPreview ? (
                        <img src={fotoPreview} alt="" />
                      ) : (
                        <span>Sem imagem</span>
                      )}
                    </div>

                    <div className="admin2-field admin2-photo-field">
                      <label>
                        {isEdit
                          ? 'Trocar imagem principal'
                          : 'Selecionar imagem principal'}
                      </label>

                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                      />

                      <span className="admin2-field-help">
                        Esta imagem aparece nos cards e listagens.
                      </span>
                    </div>
                  </div>
                </div>

               <div className="admin2-media-group admin2-gallery-group">
                <div className="admin2-media-label">
                  Imagens da galeria

                  {galeria.length > 0 && (
                    <span className="admin2-gallery-count">
                      {galeria.length} {galeria.length === 1 ? 'imagem' : 'imagens'}
                    </span>
                  )}
                </div>

                {galeria.length > 0 ? (
                  <div className="admin2-gallery-compact">
                    <div className="admin2-gallery-compact-images">
                      {galeria.slice(0, 3).map((imagem, index) => {
                        const src = imagem?.peq || imagem?.gde || '';

                        return (
                          <div
                            className="admin2-gallery-compact-thumb"
                            key={`${src}-${index}`}
                          >
                            {src ? (
                              <img
                                src={src}
                                alt={`Imagem ${index + 1} da galeria`}
                              />
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        );
                      })}

                      {galeria.length > 3 && (
                        <div className="admin2-gallery-more">
                          +{galeria.length - 3}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="admin2-gallery-manage-btn"
                      onClick={() => setGalleryManagerOpen(true)}
                    >
                      Gerenciar galeria
                    </button>
                  </div>
                ) : (
                  <div className="admin2-gallery-compact admin2-gallery-compact-empty">
                    <span>Nenhuma imagem adicional cadastrada.</span>

                    <button
                      type="button"
                      className="admin2-gallery-manage-btn"
                      onClick={() => setGalleryManagerOpen(true)}
                    >
                      + Adicionar imagens
                    </button>
                  </div>
                )}
              </div> 


              </div>

              <div className="admin2-form-grid admin2-form-grid-2">
                <div className="admin2-field">
                  <label>Código Ori *</label>
                  <input
                    type="text"
                    value={codigo}
                    onChange={(event) => setCodigo(event.target.value)}
                    required
                  />
                </div>

                <div className="admin2-field">
                  <label>Código original</label>
                  <input
                    type="text"
                    value={original}
                    onChange={(event) => setOriginal(event.target.value)}
                  />
                </div>
              </div>

              <div className="admin2-form-grid admin2-form-grid-3">
                <div className="admin2-field">
                  <label>Marca *</label>
                  <select
                    value={marca}
                    onChange={(event) => setMarca(event.target.value)}
                    required
                  >
                    <option value="">Selecione uma marca...</option>

                    {marcas.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin2-field">
                  <label>Categoria *</label>
                  <select
                    value={categoria}
                    onChange={(event) => setCategoria(event.target.value)}
                    required
                  >
                    <option value="">Selecione uma categoria...</option>

                    {categorias.map((item) => (
                      <option key={item.id} value={item.nome}>
                        {`${'\u00A0\u00A0'.repeat(item.level ?? 0)}${
                          (item.level ?? 0) > 0 ? '↳ ' : ''
                        }${item.nome}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin2-field">
                  <label>Código de conversão</label>
                  <input
                    type="text"
                    value={numeroConversao}
                    onChange={(event) => setNumeroConversao(event.target.value)}
                  />
                </div>
              </div>

              <div className="admin2-field">
                <label>Descrição *</label>
                <textarea
                  rows="3"
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                  required
                />
              </div>
            </section>

            <section className="admin2-form-section">
              <div className="admin2-form-section-title">
                <div>
                  <h3>Aplicações</h3>
                  <p>Veículos compatíveis com este produto.</p>
                </div>

                <button
                  type="button"
                  className="admin2-secondary-btn"
                  onClick={addApplication}
                >
                  + Adicionar aplicação
                </button>
              </div>

              <div className="admin2-applications">
                {aplicacoes.map((application, index) => (
                  <div className="admin2-application-card" key={index}>
                    <div className="admin2-application-number">
                      Aplicação {index + 1}
                    </div>

                    <div className="admin2-application-grid">
                      <div className="admin2-field">
                        <label>Veículo</label>
                        <input
                          type="text"
                          value={application.veiculo}
                          onChange={(event) =>
                            updateApplication(index, 'veiculo', event.target.value)
                          }
                        />
                      </div>

                      <div className="admin2-field">
                        <label>Geração</label>
                        <input
                          type="text"
                          value={application.geracao}
                          onChange={(event) =>
                            updateApplication(index, 'geracao', event.target.value)
                          }
                        />
                      </div>

                      <div className="admin2-field">
                        <label>Portas</label>
                        <input
                          type="text"
                          value={application.portas}
                          onChange={(event) =>
                            updateApplication(index, 'portas', event.target.value)
                          }
                        />
                      </div>

                      <div className="admin2-field">
                        <label>Ano inicial</label>
                        <input
                          type="text"
                          value={application.ano_apos}
                          onChange={(event) =>
                            updateApplication(index, 'ano_apos', event.target.value)
                          }
                        />
                      </div>

                      <div className="admin2-field">
                        <label>Ano final</label>
                        <input
                          type="text"
                          value={application.ate}
                          onChange={(event) =>
                            updateApplication(index, 'ate', event.target.value)
                          }
                        />
                      </div>

                      <div className="admin2-field admin2-field-observation">
                        <label>Observação</label>
                        <input
                          type="text"
                          value={application.obs}
                          onChange={(event) =>
                            updateApplication(index, 'obs', event.target.value)
                          }
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="admin2-remove-application"
                      onClick={() => removeApplication(index)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin2-form-section">
              <h3>Dados adicionais</h3>

              <div className="admin2-form-grid admin2-form-grid-2">
                <div className="admin2-field">
                  <label>Peso líquido</label>
                  <input
                    type="text"
                    value={pesoLiquido}
                    onChange={(event) => setPesoLiquido(event.target.value)}
                    placeholder="Ex: 0,154 kg"
                  />
                </div>

                <div className="admin2-field">
                  <label>Código de barras</label>
                  <input
                    type="text"
                    value={barras}
                    onChange={(event) => setBarras(event.target.value)}
                  />
                </div>
              </div>

              <div className="admin2-field">
                <label>Linha(s)</label>

                <div className="admin2-line-options">
                  {ADMIN2_LINES.map((line) => (
                    <label key={line}>
                      <input
                        type="checkbox"
                        checked={linhas.includes(line)}
                        onChange={() => toggleLine(line)}
                      />
                      <span>{line}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {error && <div className="admin2-form-error">{error}</div>}
          </div>

          <div className="admin2-modal-footer">
            <button
              type="button"
              className="admin2-modal-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="admin2-primary-btn"
              disabled={saving}
            >
              {saving
                ? 'Salvando...'
                : isEdit
                  ? 'Salvar alterações'
                  : 'Salvar produto'}
            </button>
                    </div>
        </form>
      </div>

      {galleryManagerOpen && (
        <div
          className="admin2-gallery-manager-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !galleryUploading
            ) {
              setGalleryManagerOpen(false);
            }
          }}
        >
          <div className="admin2-gallery-manager">
            <div className="admin2-gallery-manager-header">
              <div>
                <h2>Galeria de imagens</h2>
                <p>
                  Cód. {codigo} · {galeria.length}{' '}
                  {galeria.length === 1 ? 'imagem adicional' : 'imagens adicionais'}
                </p>
              </div>

              <button
                type="button"
                className="admin2-modal-close"
                onClick={() => setGalleryManagerOpen(false)}
                disabled={galleryUploading}
                aria-label="Fechar galeria"
              >
                ×
              </button>
            </div>

            <div className="admin2-gallery-manager-body">
              <div className="admin2-gallery-manager-toolbar">
                <div>
                  <strong>Imagens do produto</strong>
                  <span>
                    Escolha uma imagem como principal ou remova imagens que não serão mais utilizadas.
                  </span>
                </div>

                <label className="admin2-gallery-upload-btn">
                  {galleryUploading
                    ? 'Enviando...'
                    : gallerySaving
                      ? 'Salvando...'
                      : '+ Adicionar imagens'}

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={galleryUploading || gallerySaving}
                    onChange={handleGalleryAdd}
                  />
                </label>
              </div>

              {galeria.length > 0 ? (
                <div className="admin2-gallery-manager-grid">
                  {galeria.map((imagem, index) => {
                    const src = imagem?.gde || imagem?.peq || '';

                    return (
                      <div
                        className="admin2-gallery-manager-card"
                        key={`${src}-${index}`}
                      >
                        <div className="admin2-gallery-manager-image">
                          {src ? (
                            <img
                              src={src}
                              alt={`Imagem ${index + 1} da galeria`}
                            />
                          ) : (
                            <span>Imagem indisponível</span>
                          )}
                        </div>

                        <div className="admin2-gallery-manager-card-footer">
                          <span>Imagem {index + 1}</span>

                          <div className="admin2-gallery-manager-actions">
                            <button
                              type="button"
                              disabled={gallerySaving || galleryUploading}
                              onClick={() =>
                                setGalleryImageAsMain(index)
                              }
                            >
                              Definir como principal
                            </button>

                            <button
                              type="button"
                              className="is-danger"
                              disabled={gallerySaving || galleryUploading}
                              onClick={() =>
                                removeGalleryImage(index)
                              }
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin2-gallery-manager-empty">
                  <strong>Nenhuma imagem na galeria.</strong>
                  <span>
                    Adicione uma ou mais imagens para complementar a apresentação do produto.
                  </span>
                </div>
              )}
            </div>

            <div className="admin2-gallery-manager-footer">
              <span>
                As alterações da galeria são salvas automaticamente.
              </span>

              <button
                type="button"
                className="admin2-primary-btn"
                onClick={() => setGalleryManagerOpen(false)}
                disabled={galleryUploading}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function ProductsSection() {
  const { session } = useAuth();

  const [produtos, setProdutos] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [lineFilter, setLineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);

      const [productsResult, categoriesResult] = await Promise.all([
        supabase
          .from('produtos')
          .select(
            'id, codigo, descricao, marca, categoria, linha, original, numero_conversao, aplicacoes, peso_liquido, barras, galeria, ativo, foto_local, foto_local_gde, updated_at, updated_by'
          )
          .order('codigo')
          .limit(4000),

        supabase
          .from('catalogo_categorias')
          .select('id, nome, parent_id, ordem, ativo')
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
      ]);

      if (!cancelled) {
        if (productsResult.error) {
          console.error('Erro ao carregar produtos:', productsResult.error);
          setProdutos([]);
        } else {
          setProdutos(productsResult.data ?? []);
        }

        if (categoriesResult.error) {
          console.error(
            'Erro ao carregar categorias:',
            categoriesResult.error
          );
          setCatalogCategories([]);
        } else {
          setCatalogCategories(categoriesResult.data ?? []);
        }

        setLoading(false);
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const ordered = [];

    function addWithChildren(category, level = 0) {
      ordered.push({
        ...category,
        level,
      });

      const children = catalogCategories
        .filter((item) => item.parent_id === category.id)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

      for (const child of children) {
        addWithChildren(child, level + 1);
      }
    }

    const roots = catalogCategories
      .filter((category) => !category.parent_id)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    for (const root of roots) {
      addWithChildren(root);
    }

    return ordered;
  }, [catalogCategories]);

  const categoryFilterNames = useMemo(() => {
    if (!categoryFilter) return null;

    const selectedCategory = catalogCategories.find(
      (category) => category.nome === categoryFilter
    );

    if (!selectedCategory) {
      return new Set([categoryFilter]);
    }

    const names = new Set();

    function addCategoryAndChildren(category) {
      names.add(category.nome);

      const children = catalogCategories.filter(
        (item) => item.parent_id === category.id
      );

      for (const child of children) {
        addCategoryAndChildren(child);
      }
    }

    addCategoryAndChildren(selectedCategory);

    return names;
  }, [catalogCategories, categoryFilter]);

  const brands = useMemo(
    () =>
      [...new Set(produtos.map((p) => p.marca).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    [produtos]
  );

  const lines = useMemo(() => {
    const allLines = produtos.flatMap((p) =>
      (p.linha || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    );

    return [...new Set(allLines)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [produtos]);

  
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR');

    const hasFilters =
      q ||
      categoryFilter ||
      brandFilter ||
      lineFilter ||
      statusFilter === 'inactive' ||
      statusFilter === 'all';

    if (!hasFilters) return [];

    const matches = produtos.filter((produto) => {
      if (statusFilter === 'active' && produto.ativo !== true) return false;
      if (statusFilter === 'inactive' && produto.ativo !== false) return false;

      if (
        categoryFilter &&
        !categoryFilterNames?.has(produto.categoria)
      ) {
        return false;
      }
      if (brandFilter && produto.marca !== brandFilter) return false;

      if (lineFilter) {
        const productLines = (produto.linha || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

        if (!productLines.includes(lineFilter)) return false;
      }

      if (q) {
        const codigo = String(produto.codigo || '').toLocaleLowerCase('pt-BR');
        const original = String(produto.original || '').toLocaleLowerCase('pt-BR');
        const descricao = String(produto.descricao || '').toLocaleLowerCase('pt-BR');
        const marca = String(produto.marca || '').toLocaleLowerCase('pt-BR');
        const categoria = String(produto.categoria || '').toLocaleLowerCase('pt-BR');

        const searchable = [
          codigo,
          original,
          descricao,
          marca,
          categoria,
        ].join(' ');

        if (!searchable.includes(q)) return false;
      }

      return true;
    });

    if (!q) return matches.slice(0, 50);

    return matches
      .sort((a, b) => {
        const codigoA = String(a.codigo || '').toLocaleLowerCase('pt-BR');
        const codigoB = String(b.codigo || '').toLocaleLowerCase('pt-BR');

        const exactA = codigoA === q ? 0 : 1;
        const exactB = codigoB === q ? 0 : 1;

        if (exactA !== exactB) return exactA - exactB;

        const startsA = codigoA.startsWith(q) ? 0 : 1;
        const startsB = codigoB.startsWith(q) ? 0 : 1;

        if (startsA !== startsB) return startsA - startsB;

        return codigoA.localeCompare(codigoB, 'pt-BR', { numeric: true });
      })
      .slice(0, 50);
  }, [
    produtos,
    search,
    categoryFilter,
    categoryFilterNames,
    brandFilter,
    lineFilter,
    statusFilter,
  ]);



  function clearFilters() {
  setSearch('');
  setCategoryFilter('');
  setBrandFilter('');
  setLineFilter('');
  setStatusFilter('active');
}

async function toggleProductStatus(produto) {
  const nextActive = !produto.ativo;

  const confirmed = window.confirm(
    nextActive
      ? `Reativar o produto ${produto.codigo}?`
      : `Desativar o produto ${produto.codigo}?`
  );

  if (!confirmed) return;

  const { data, error } = await supabase
    .from('produtos')
    .update({
      ativo: nextActive,
    })
    .eq('id', produto.id)
    .eq('updated_at', produto.updated_at)
    .select(
      'id, codigo, descricao, marca, categoria, linha, original, numero_conversao, aplicacoes, peso_liquido, barras, galeria, ativo, foto_local, foto_local_gde, updated_at, updated_by'
    )
    .maybeSingle();

  if (error) {
    console.error('Erro ao alterar status do produto:', error);

    window.alert(
      nextActive
        ? 'Não foi possível reativar o produto.'
        : 'Não foi possível desativar o produto.'
    );

    return;
  }

  if (!data) {
    window.alert(
      'Este produto foi alterado por outro administrador. Atualize a página antes de tentar novamente.'
    );
    return;
  }

  setProdutos((current) =>
    current.map((item) =>
      item.id === data.id ? data : item
    )
  );
}

return (
    <section className="admin2-products">
      <div className="admin2-products-toolbar">
        <div>
          <h2>Produtos</h2>
          <p>
            {loading
              ? 'Carregando produtos...'
              : filteredProducts.length
                ? `${filteredProducts.length.toLocaleString('pt-BR')} resultado${filteredProducts.length === 1 ? '' : 's'}`
                : `${produtos.length.toLocaleString('pt-BR')} produtos cadastrados`}
          </p>
        </div>

        <button
          type="button"
          className="admin2-primary-btn"
          onClick={() =>
            setEditingProduct({
              __new: true,
              aplicacoes: [],
              galeria: [],
            })
          }
        >
          + Novo produto
        </button>
      </div>

      <div className="admin2-products-filters">
        <div className="admin2-products-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Buscar código, descrição, original, marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
         <option value="">Todas as categorias</option>

        {categories.map((category) => (
          <option key={category.id} value={category.nome}>
            {`${'\u00A0\u00A0'.repeat(category.level)}${
              category.level > 0 ? '↳ ' : ''
            }${category.nome}`}
          </option>
        ))}
        </select>

        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        >
          <option value="">Todas as marcas</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>

        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
        >
          <option value="">Todas as linhas</option>
          {lines.map((line) => (
            <option key={line} value={line}>
              {line}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="all">Todos</option>
        </select>

        {(search ||
          categoryFilter ||
          brandFilter ||
          lineFilter ||
          statusFilter !== 'active') && (
          <button
            type="button"
            className="admin2-clear-btn"
            onClick={clearFilters}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="admin2-products-table-wrap">
        <table className="admin2-products-table">
          <thead>
            <tr>
              <th className="admin2-col-image">Imagem</th>
              <th className="admin2-col-code">Código</th>
              <th>Produto</th>
              <th>Marca</th>
              <th>Categoria</th>
              <th>Linha</th>
              <th className="admin2-col-status">Status</th>
              <th className="admin2-col-actions">Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="admin2-table-empty">
                  Carregando produtos...
                </td>
              </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="admin2-table-empty">
                    {search ||
                    categoryFilter ||
                    brandFilter ||
                    lineFilter ||
                    statusFilter !== 'active'
                      ? 'Nenhum produto encontrado com estes critérios.'
                      : 'Busque por código, referência ou descrição, ou use os filtros para localizar produtos.'}
                  </td>
                </tr>
              ) : (
              filteredProducts.map((produto) => {
                const photo = produto.foto_local || produto.foto_local_gde;

                return (
                  <tr key={produto.id}>
                    <td className="admin2-col-image">
                      <div className="admin2-product-thumb">
                        {photo ? (
                          <img src={photo} alt="" />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </td>

                    <td className="admin2-product-code">
                      {produto.codigo || '—'}
                    </td>

                    <td>
                      <div className="admin2-product-description">
                        {produto.descricao || 'Sem descrição'}
                      </div>

                      {produto.original && (
                        <div className="admin2-product-secondary">
                          Original: {produto.original}
                        </div>
                      )}
                    </td>

                    <td>{produto.marca || '—'}</td>
                    <td>{produto.categoria || '—'}</td>
                    <td>{produto.linha || '—'}</td>

                    <td className="admin2-col-status">
                      <span
                        className={`admin2-status ${
                          produto.ativo ? 'is-active' : 'is-inactive'
                        }`}
                      >
                        {produto.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    <td className="admin2-col-actions">
                      <button
                        type="button"
                        className="admin2-edit-btn"
                        onClick={() => setEditingProduct(produto)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="admin2-more-btn"
                        aria-label={
                          produto.ativo
                            ? `Desativar produto ${produto.codigo}`
                            : `Reativar produto ${produto.codigo}`
                        }
                        title={produto.ativo ? 'Desativar produto' : 'Reativar produto'}
                        onClick={() => toggleProductStatus(produto)}
                      >
                        ⋮
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editingProduct && (
        <Admin2ProductEditModal
          produto={editingProduct}
          marcas={brands}
          categorias={categories}
          session={session}
          onClose={() => setEditingProduct(null)}
          onSaved={(savedProduct) => {
            setProdutos((current) => {
              const alreadyExists = current.some(
                (item) => item.id === savedProduct.id
              );

              if (alreadyExists) {
                return current.map((item) =>
                  item.id === savedProduct.id
                    ? savedProduct
                    : item
                );
              }

              return [...current, savedProduct];
            });

            setEditingProduct(null);
          }}
        />
      )}
    </section>
  );
}

function CategoriesSection() {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  useEffect(() => {
    async function loadCategorias() {
      setLoading(true);
      setError('');

      try {
        const { data: categoriasData, error: categoriasError } = await supabase
          .from('catalogo_categorias')
          .select('id, nome, parent_id, ordem, ativo')
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true });

        if (categoriasError) throw categoriasError;

        const { data: produtosData, error: produtosError } = await supabase
          .from('produtos')
          .select('categoria');

        if (produtosError) throw produtosError;

        const contagemPorCategoria = new Map();

        for (const produto of produtosData ?? []) {
          const nome = produto.categoria?.trim();

          if (!nome) continue;

          contagemPorCategoria.set(
            nome,
            (contagemPorCategoria.get(nome) ?? 0) + 1
          );
        }

        const categoriasComContagem = (categoriasData ?? []).map((categoria) => ({
          ...categoria,
          total_produtos: contagemPorCategoria.get(categoria.nome) ?? 0,
        }));

        setCategorias(categoriasComContagem);
      } catch (err) {
        console.error(err);
        setError('Não foi possível carregar as categorias.');
      } finally {
        setLoading(false);
      }
    }

    loadCategorias();
  }, []);

  const categoriasPorId = new Map(
    categorias.map((categoria) => [categoria.id, categoria])
  );

  const categoriasOrdenadas = [];

  function adicionarCategoriaComFilhos(categoria, nivel = 0) {
    categoriasOrdenadas.push({
      ...categoria,
      nivel,
    });

    const filhos = categorias
      .filter((item) => item.parent_id === categoria.id)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    for (const filho of filhos) {
      adicionarCategoriaComFilhos(filho, nivel + 1);
    }
  }

const categoriasRaiz = categorias
  .filter((categoria) => !categoria.parent_id)
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

for (const categoria of categoriasRaiz) {
  adicionarCategoriaComFilhos(categoria);
}

  if (loading) {
    return (
      <div className="admin2-empty-state">
        Carregando categorias...
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin2-empty-state admin2-empty-state-error">
        {error}
      </div>
    );
  }

  return (
    <section className="admin2-categories">
      <div className="admin2-section-heading">
        <div>
          <h2>Categorias</h2>
          <p>Organize as categorias utilizadas no catálogo de produtos.</p>
        </div>

        <div className="admin2-section-actions">
          <div className="admin2-categories-summary">
            {categorias.length} categorias
          </div>

          <button
            type="button"
            className="admin2-primary-button"
            onClick={() => setCreateModalOpen(true)}
          >
            + Nova categoria
          </button>
        </div>
      </div>

      <div className="admin2-table-card">
        <div className="admin2-categories-table">
          <div className="admin2-categories-row admin2-categories-row-head">
            <div>Categoria</div>
            <div>Categoria superior</div>
            <div>Produtos</div>
            <div>Status</div>
            <div>Ações</div>
          </div>

          {categoriasOrdenadas.map((categoria) => {
            const parent = categoria.parent_id
              ? categoriasPorId.get(categoria.parent_id)
              : null;

            return (
              <div
                key={categoria.id}
                className="admin2-categories-row"
              >
                <div
                  className="admin2-category-name"
                  style={{
                    paddingLeft: `${categoria.nivel * 18}px`,
                  }}
                >
                  {categoria.nivel > 0 && (
                    <span className="admin2-category-child-mark">
                      ↳
                    </span>
                  )}

                  <strong>{categoria.nome}</strong>
                </div>

                <div className="admin2-category-parent">
                  {parent?.nome ?? '—'}
                </div>

                <div>
                  {categoria.total_produtos.toLocaleString('pt-BR')}
                </div>

                <div>
                  <span
                    className={
                      categoria.ativo
                        ? 'admin2-status admin2-status-active'
                        : 'admin2-status admin2-status-inactive'
                    }
                  >
                    {categoria.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <div>
                  <button
                    type="button"
                    className="admin2-link-button"
                    onClick={() => setEditingCategory(categoria)}
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {createModalOpen && (
        <CategoryModal
          categorias={categorias}
          onClose={() => setCreateModalOpen(false)}
          onSaved={(savedCategory) => {
            setCategorias((current) => [...current, savedCategory]);
            setCreateModalOpen(false);
          }}
        />
      )}

      {editingCategory && (
        <CategoryModal
          categoria={editingCategory}
          categorias={categorias}
          onClose={() => setEditingCategory(null)}
          onSaved={(savedCategory) => {
            setCategorias((current) =>
              current.map((item) =>
                item.id === savedCategory.id
                  ? {
                      ...item,
                      ...savedCategory,
                    }
                  : item
              )
            );

            setEditingCategory(null);
          }}
        />
      )}
    </section>
  );
}


function CategoryModal({ categoria = null, categorias, onClose, onSaved }) {
  const isEdit = !!categoria?.id;

  const [nome, setNome] = useState(categoria?.nome ?? '');
  const [parentId, setParentId] = useState(
    categoria?.parent_id ? String(categoria.parent_id) : ''
  );
  const [ativo, setAtivo] = useState(categoria?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      setError('Informe o nome da categoria.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let query;

      if (isEdit) {
        query = supabase
          .from('catalogo_categorias')
          .update({
            nome: nomeLimpo,
            parent_id: parentId ? Number(parentId) : null,
            ativo,
          })
          .eq('id', categoria.id);
      } else {
        query = supabase
          .from('catalogo_categorias')
          .insert({
            nome: nomeLimpo,
            parent_id: parentId ? Number(parentId) : null,
            ativo,
          });
      }

      const { data, error: saveError } = await query
        .select('id, nome, parent_id, ordem, ativo')
        .single();

      if (saveError) throw saveError;

      onSaved({
        ...data,
        total_produtos: isEdit ? categoria.total_produtos : 0,
      });
    } catch (err) {
      console.error(err);

      if (err?.code === '23505') {
        setError('Já existe uma categoria com esse nome.');
      } else {
        setError('Não foi possível criar a categoria.');
      }
    } finally {
      setSaving(false);
    }
  }

  const categoriasAtivas = categorias
    .filter((item) => item.ativo && item.id !== categoria?.id)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <div
      className="admin2-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="admin2-category-modal">
        <div className="admin2-category-modal-header">
          <div>
            <h2>{isEdit ? 'Editar categoria' : 'Nova categoria'}</h2>

            <p>
              {isEdit
                ? 'Altere o nome, a categoria superior ou o status.'
                : 'Crie uma categoria raiz ou vincule-a a uma categoria superior.'}
            </p>
          </div>

          <button
            type="button"
            className="admin2-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin2-category-modal-body">
            {error && (
              <div className="admin2-category-modal-error">
                {error}
              </div>
            )}

            <label className="admin2-field">
              <span>Nome da categoria</span>
              <input
                type="text"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Ex.: Elétrica"
                autoFocus
              />
            </label>

            <label className="admin2-field">
              <span>Categoria superior</span>

              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">Nenhuma</option>

                {categoriasAtivas.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin2-category-status-toggle">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(event) => setAtivo(event.target.checked)}
              />

              <span>
                <strong>Categoria ativa</strong>
                <small>
                  Categorias inativas permanecem cadastradas, mas podem ser ocultadas do catálogo.
                </small>
              </span>
            </label>
          </div>

          <div className="admin2-category-modal-footer">
            <button
              type="button"
              className="admin2-secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="admin2-primary-button"
              disabled={saving}
            >
              {saving
                ? isEdit
                  ? 'Salvando...'
                  : 'Criando...'
                : isEdit
                  ? 'Salvar alterações'
                  : 'Criar categoria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Admin2HighlightSlot({
  slot,
  index,
  categorias,
  categoriasUsadas,
  onChangeCategoria,
  onRemove,
  onAddProduto,
  onRemoveProduto,
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!slot.categoria) {
      setResults([]);
      return undefined;
    }

    let cancelled = false;

    setSearching(true);

    const timeout = setTimeout(async () => {
      let query = supabase
        .from('produtos')
        .select('id, codigo, marca, descricao, foto_local')
        .eq('categoria', slot.categoria)
        .eq('ativo', true)
        .order('codigo')
        .limit(12);

      if (search.trim()) {
        const q = search.trim();

        query = query.or(
          `descricao.ilike.%${q}%,codigo.ilike.%${q}%`
        );
      }

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        console.error('Erro ao buscar produtos para destaque:', error);
        setResults([]);
      } else {
        setResults(
          (data ?? []).filter(
            (produto) => !slot.produtoIds.includes(produto.id)
          )
        );
      }

      setSearching(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, slot.categoria, slot.produtoIds]);

  const categoriasDisponiveis = categorias.filter(
    (categoria) =>
      categoria === slot.categoria ||
      !categoriasUsadas.includes(categoria)
  );

  return (
    <div className="admin2-highlight-slot">
      <div className="admin2-highlight-slot-header">
        <div className="admin2-highlight-slot-title">
          <span>Vitrine {index + 1}</span>

          <select
            value={slot.categoria}
            onChange={(event) => {
              setSearch('');
              onChangeCategoria(index, event.target.value);
            }}
          >
            <option value="">Escolher categoria...</option>

            {categoriasDisponiveis.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="admin2-highlight-remove-slot"
          onClick={() => onRemove(index)}
          title="Remover vitrine"
          aria-label={`Remover vitrine ${index + 1}`}
        >
          ×
        </button>
      </div>

      {slot.categoria && (
        <div className="admin2-highlight-slot-body">
          <div className="admin2-highlight-selected">
            <div className="admin2-highlight-selected-heading">
              <strong>Produtos selecionados</strong>

              <span>
                {slot.produtos.length} / {ADMIN2_MAX_HIGHLIGHT_PRODUCTS}
              </span>
            </div>

            {slot.produtos.length === 0 ? (
              <div className="admin2-highlight-selected-empty">
                Nenhum produto selecionado.
              </div>
            ) : (
              <div className="admin2-highlight-selected-grid">
                {slot.produtos.map((produto) => (
                  <div
                    className="admin2-highlight-product"
                    key={produto.id}
                  >
                    <div className="admin2-highlight-product-photo">
                      {produto.foto_local ? (
                        <img src={produto.foto_local} alt="" />
                      ) : (
                        <span>—</span>
                      )}
                    </div>

                    <div className="admin2-highlight-product-copy">
                      <strong>Cód. {produto.codigo}</strong>
                      <span>{produto.descricao}</span>
                      {produto.marca && <small>{produto.marca}</small>}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onRemoveProduto(index, produto.id)
                      }
                      aria-label={`Remover produto ${produto.codigo}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {slot.produtoIds.length < ADMIN2_MAX_HIGHLIGHT_PRODUCTS && (
            <div className="admin2-highlight-search">
              <label>
                Adicionar produto de “{slot.categoria}”
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por código ou descrição..."
              />

              <div className="admin2-highlight-results">
                {searching ? (
                  <div className="admin2-highlight-results-empty">
                    Buscando...
                  </div>
                ) : results.length === 0 ? (
                  <div className="admin2-highlight-results-empty">
                    Nenhum produto disponível.
                  </div>
                ) : (
                  results.map((produto) => (
                    <button
                      type="button"
                      className="admin2-highlight-result"
                      key={produto.id}
                      onClick={() => {
                        onAddProduto(index, produto);
                        setSearch('');
                      }}
                    >
                      <div className="admin2-highlight-result-photo">
                        {produto.foto_local ? (
                          <img src={produto.foto_local} alt="" />
                        ) : (
                          <span>—</span>
                        )}
                      </div>

                      <div>
                        <strong>Cód. {produto.codigo}</strong>
                        <span>{produto.descricao}</span>
                      </div>

                      <b>+</b>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Admin2UserEditModal({
  user,
  session,
  onClose,
  onSaved,
}) {
  const isSelf = user.id === session.user.id;

  const [nome, setNome] = useState(user.nome ?? '');
  const [email] = useState(user.email ?? '');
  const [telefone, setTelefone] = useState(user.telefone ?? '');
  const [empresa, setEmpresa] = useState(user.empresa ?? '');
  const [cidade, setCidade] = useState(user.cidade ?? '');
  const [uf, setUf] = useState(user.uf ?? '');
  const [regiao, setRegiao] = useState(user.regiao ?? '');
  const [cargo, setCargo] = useState(user.cargo ?? '');
  const [cnpj, setCnpj] = useState(user.cnpj ?? '');
  const [role, setRole] = useState(user.role ?? 'cliente');
  const [ativo, setAtivo] = useState(user.ativo !== false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSelf && role !== 'admin') {
      setError('Você não pode remover seu próprio acesso de administrador.');
      return;
    }

    if (isSelf && !ativo) {
      setError('Você não pode desativar sua própria conta.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      nome: nome.trim() || null,
      telefone: telefone.trim() || null,
      empresa: empresa.trim() || null,
      cidade: cidade.trim() || null,
      uf: uf.trim().toUpperCase() || null,
      regiao: regiao.trim() || null,
      cargo: cargo.trim() || null,
      cnpj: cnpj.trim() || null,
      role,
      ativo,
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    };

    const { data, error: saveError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)
      .select('*')
      .single();

    setSaving(false);

    if (saveError) {
      console.error(saveError);
      setError(`Erro ao salvar: ${saveError.message}`);
      return;
    }

    onSaved(data);
  }

  return (
    <div className="admin2-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="admin2-user-modal">
        <div className="admin2-user-modal-header">
          <div>
            <h2>Editar usuário</h2>
            <p>{email || 'Usuário sem e-mail informado'}</p>
          </div>

          <button
            type="button"
            className="admin2-user-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin2-user-form-grid">
            <label>
              <span>Nome</span>
              <input
                type="text"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
              />
            </label>

            <label>
              <span>E-mail</span>
              <input
                type="email"
                value={email}
                disabled
              />
            </label>

            <label>
              <span>Telefone</span>
              <input
                type="text"
                value={telefone}
                onChange={(event) => setTelefone(event.target.value)}
              />
            </label>

            <label>
              <span>Empresa</span>
              <input
                type="text"
                value={empresa}
                onChange={(event) => setEmpresa(event.target.value)}
              />
            </label>

            <label>
              <span>Cargo</span>
              <input
                type="text"
                value={cargo}
                onChange={(event) => setCargo(event.target.value)}
              />
            </label>

            <label>
              <span>CNPJ</span>
              <input
                type="text"
                value={cnpj}
                onChange={(event) => setCnpj(event.target.value)}
              />
            </label>

            <label>
              <span>Cidade</span>
              <input
                type="text"
                value={cidade}
                onChange={(event) => setCidade(event.target.value)}
              />
            </label>

            <label>
              <span>UF</span>
              <input
                type="text"
                value={uf}
                maxLength={2}
                onChange={(event) => setUf(event.target.value)}
              />
            </label>

            <label>
              <span>Região</span>
              <input
                type="text"
                value={regiao}
                onChange={(event) => setRegiao(event.target.value)}
              />
            </label>

            <label>
              <span>Perfil</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={isSelf}
              >
                <option value="cliente">Cliente</option>
                <option value="vendedor">Representante</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
          </div>

          <label className="admin2-user-active-field">
            <input
              type="checkbox"
              checked={ativo}
              disabled={isSelf}
              onChange={(event) => setAtivo(event.target.checked)}
            />

            <span>
              <strong>Usuário ativo</strong>
              <small>
                Usuários inativos permanecem cadastrados, mas ficam marcados como inativos.
              </small>
            </span>
          </label>

          {isSelf && (
            <div className="admin2-user-self-note">
              Sua própria conta não pode ser desativada nem ter o perfil de administrador removido por esta tela.
            </div>
          )}

          {error && (
            <div className="admin2-form-error">
              {error}
            </div>
          )}

          <div className="admin2-user-modal-actions">
            <button
              type="button"
              className="admin2-user-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="admin2-primary-button"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function SelectionsSection() {
  const [selections, setSelections] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSelections() {
      setLoading(true);
      setError('');

      const [
        { data: selectionData, error: selectionError },
        { data: profileData, error: profileError },
      ] = await Promise.all([
        supabase
          .from('catalogo_selecoes')
          .select('*')
          .order('updated_at', { ascending: false }),

        supabase
          .from('profiles')
          .select('id, nome, email, empresa, role'),
      ]);

      if (cancelled) return;

      if (selectionError) {
        console.error(selectionError);
        setError(`Não foi possível carregar as seleções: ${selectionError.message}`);
        setLoading(false);
        return;
      }

      if (profileError) {
        console.error(profileError);
      }

      setSelections(selectionData ?? []);
      setProfiles(profileData ?? []);
      setLoading(false);
    }

    loadSelections();

    return () => {
      cancelled = true;
    };
  }, []);

  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [profile.id, profile])
      ),
    [profiles]
  );

  const filteredSelections = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return selections;

    return selections.filter((selection) => {
      const profile = profileById.get(selection.user_id);

      return [
        selection.nome,
        profile?.nome,
        profile?.email,
        profile?.empresa,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(term)
        );
    });
  }, [selections, search, profileById]);

  function renderList(values) {
    if (!Array.isArray(values) || values.length === 0) return '—';
    return values.join(', ');
  }

  if (loading) {
    return (
      <div className="admin2-empty-state">
        Carregando seleções salvas...
      </div>
    );
  }

  return (
    <section className="admin2-selections">
      <div className="admin2-selections-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por seleção, usuário, e-mail ou empresa..."
        />
      </div>

      {error && (
        <div className="admin2-form-error">
          {error}
        </div>
      )}

      <div className="admin2-selections-summary">
        {filteredSelections.length} seleção
        {filteredSelections.length === 1 ? '' : 'ões'} salva
        {filteredSelections.length === 1 ? '' : 's'}
      </div>

      {filteredSelections.length === 0 ? (
        <div className="admin2-empty-state">
          Nenhuma seleção salva encontrada.
        </div>
      ) : (
        <div className="admin2-selections-list">
          {filteredSelections.map((selection) => {
            const profile = profileById.get(selection.user_id);
            const filtros = selection.filtros ?? {};
            const isOpen = openId === selection.id;

            return (
              <article
                className="admin2-selection-card"
                key={selection.id}
              >
                <button
                  type="button"
                  className="admin2-selection-card-head"
                  onClick={() =>
                    setOpenId(isOpen ? null : selection.id)
                  }
                >
                  <div className="admin2-selection-user">
                    <strong>
                      {profile?.nome || 'Usuário'}
                    </strong>

                    <span>
                      {profile?.email || selection.user_id}
                    </span>

                    {profile?.empresa && (
                      <small>{profile.empresa}</small>
                    )}
                  </div>

                  <div className="admin2-selection-name">
                    <span>Seleção</span>
                    <strong>{selection.nome}</strong>
                  </div>

                  <div className="admin2-selection-quick">
                    <span>
                      {Array.isArray(filtros.categories)
                        ? filtros.categories.length
                        : 0}{' '}
                      categoria(s)
                    </span>

                    <span>
                      {Array.isArray(filtros.brands)
                        ? filtros.brands.length
                        : 0}{' '}
                      marca(s)
                    </span>
                  </div>

                  <div className="admin2-selection-date">
                    <span>Atualizada</span>
                    <strong>
                      {selection.updated_at
                        ? new Date(selection.updated_at).toLocaleString('pt-BR')
                        : '—'}
                    </strong>
                  </div>

                  <div className="admin2-selection-chevron">
                    {isOpen ? '⌃' : '⌄'}
                  </div>
                </button>

                {isOpen && (
                  <div className="admin2-selection-details">
                    <div>
                      <span>Categorias</span>
                      <strong>{renderList(filtros.categories)}</strong>
                    </div>

                    <div>
                      <span>Linhas</span>
                      <strong>{renderList(filtros.lines)}</strong>
                    </div>

                    <div>
                      <span>Marcas</span>
                      <strong>{renderList(filtros.brands)}</strong>
                    </div>

                    <div>
                      <span>Aplicação</span>
                      <strong>{filtros.application || '—'}</strong>
                    </div>

                    <div>
                      <span>Código Ori</span>
                      <strong>{filtros.code || '—'}</strong>
                    </div>

                    <div>
                      <span>Conversão</span>
                      <strong>{filtros.conversion || '—'}</strong>
                    </div>

                    <div>
                      <span>Código de barras</span>
                      <strong>{filtros.barcode || '—'}</strong>
                    </div>

                    <div>
                      <span>Ordenação</span>
                      <strong>{filtros.sortBy || 'codigo'}</strong>
                    </div>

                    <div>
                      <span>Criada em</span>
                      <strong>
                        {selection.created_at
                          ? new Date(selection.created_at).toLocaleString('pt-BR')
                          : '—'}
                      </strong>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}



function UsersSection() {
  const { session } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError('');

      const { data, error: loadError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (loadError) {
        console.error(loadError);
        setUsers([]);
        setError(`Não foi possível carregar os usuários: ${loadError.message}`);
      } else {
        setUsers(data ?? []);
      }

      setLoading(false);
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !term ||
        [
          user.nome,
          user.email,
          user.empresa,
          user.telefone,
          user.cidade,
          user.cnpj,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(term)
          );

      const matchesRole =
        roleFilter === 'all' || user.role === roleFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.ativo !== false) ||
        (statusFilter === 'inactive' && user.ativo === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  function handleSaved(updatedUser) {
    setUsers((current) =>
      current.map((user) =>
        user.id === updatedUser.id ? updatedUser : user
      )
    );

    setEditingUser(null);
  }

  function roleLabel(role) {
    if (role === 'admin') return 'Administrador';
    if (role === 'vendedor') return 'Representante';
    return 'Cliente';
  }

  if (loading) {
    return (
      <div className="admin2-empty-state">
        Carregando usuários...
      </div>
    );
  }

  return (
    <section className="admin2-users">
      <div className="admin2-users-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, e-mail, empresa, telefone..."
        />

        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option value="all">Todos os perfis</option>
          <option value="cliente">Clientes</option>
          <option value="vendedor">Representantes</option>
          <option value="admin">Administradores</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {error && (
        <div className="admin2-form-error">
          {error}
        </div>
      )}

      <div className="admin2-users-summary">
        {filteredUsers.length} usuário
        {filteredUsers.length === 1 ? '' : 's'}
      </div>

      {filteredUsers.length === 0 ? (
        <div className="admin2-empty-state">
          Nenhum usuário encontrado.
        </div>
      ) : (
        <div className="admin2-users-table-wrap">
          <table className="admin2-users-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Empresa</th>
                <th>Localidade</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="admin2-user-main">
                      <strong>{user.nome || 'Sem nome'}</strong>
                      <span>{user.email || '—'}</span>
                      {user.telefone && <small>{user.telefone}</small>}
                    </div>
                  </td>

                  <td>
                    <div className="admin2-user-company">
                      <strong>{user.empresa || '—'}</strong>
                      {user.cargo && <span>{user.cargo}</span>}
                    </div>
                  </td>

                  <td>
                    {[user.cidade, user.uf]
                      .filter(Boolean)
                      .join(' / ') || '—'}
                  </td>

                  <td>
                    <span
                      className={`admin2-user-role is-${user.role}`}
                    >
                      {roleLabel(user.role)}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`admin2-user-status ${
                        user.ativo === false
                          ? 'is-inactive'
                          : 'is-active'
                      }`}
                    >
                      {user.ativo === false ? 'Inativo' : 'Ativo'}
                    </span>
                  </td>

                  <td>
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>

                  <td className="admin2-users-actions">
                    <button
                      type="button"
                      onClick={() => setEditingUser(user)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingUser && (
        <Admin2UserEditModal
          user={editingUser}
          session={session}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}


function HighlightsSection() {
  const { session } = useAuth();

  const [categorias, setCategorias] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadHighlights() {
      setLoading(true);
      setError('');

      const [productsResult, contentResult] = await Promise.all([
        supabase
          .from('produtos')
          .select('categoria')
          .eq('ativo', true)
          .limit(4000),

        supabase
          .from('conteudo_site')
          .select('valor')
          .eq('chave', 'destaques')
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (productsResult.error) {
        console.error(productsResult.error);
        setError('Não foi possível carregar as categorias.');
        setLoading(false);
        return;
      }

      if (contentResult.error) {
        console.error(contentResult.error);
        setError('Não foi possível carregar os destaques.');
        setLoading(false);
        return;
      }

      const categoryNames = [
        ...new Set(
          (productsResult.data ?? [])
            .map((produto) => produto.categoria?.trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

      setCategorias(categoryNames);

      const savedSlots = Array.isArray(contentResult.data?.valor)
        ? contentResult.data.valor
        : [];

      if (!savedSlots.length) {
        setSlots([]);
        setLoading(false);
        return;
      }

      const ids = savedSlots.flatMap(
        (slot) => slot.produto_ids ?? []
      );

      const { data: products, error: productsError } = ids.length
        ? await supabase
            .from('produtos')
            .select('id, codigo, marca, descricao, foto_local')
            .in('id', ids)
        : { data: [], error: null };

      if (cancelled) return;

      if (productsError) {
        console.error(productsError);
        setError('Não foi possível carregar os produtos destacados.');
        setLoading(false);
        return;
      }

      const productsById = new Map(
        (products ?? []).map((produto) => [
          produto.id,
          produto,
        ])
      );

      setSlots(
        savedSlots.map((slot) => ({
          categoria: slot.categoria ?? '',
          produtoIds: slot.produto_ids ?? [],
          produtos: (slot.produto_ids ?? [])
            .map((id) => productsById.get(id))
            .filter(Boolean),
        }))
      );

      setLoading(false);
    }

    loadHighlights();

    return () => {
      cancelled = true;
    };
  }, []);

  const categoriasUsadas = slots
    .map((slot) => slot.categoria)
    .filter(Boolean);

  function addSlot() {
    setSlots((current) =>
      current.length >= ADMIN2_MAX_HIGHLIGHT_CATEGORIES
        ? current
        : [...current, emptyAdmin2HighlightSlot()]
    );
  }

  function removeSlot(index) {
    setSlots((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function changeCategoria(index, categoria) {
    setSlots((current) =>
      current.map((slot, itemIndex) =>
        itemIndex === index
          ? {
              categoria,
              produtoIds: [],
              produtos: [],
            }
          : slot
      )
    );
  }

  function addProduto(index, produto) {
    setSlots((current) =>
      current.map((slot, itemIndex) => {
        if (
          itemIndex !== index ||
          slot.produtoIds.length >= ADMIN2_MAX_HIGHLIGHT_PRODUCTS ||
          slot.produtoIds.includes(produto.id)
        ) {
          return slot;
        }

        return {
          ...slot,
          produtoIds: [...slot.produtoIds, produto.id],
          produtos: [...slot.produtos, produto],
        };
      })
    );
  }

  function removeProduto(index, produtoId) {
    setSlots((current) =>
      current.map((slot, itemIndex) =>
        itemIndex === index
          ? {
              ...slot,
              produtoIds: slot.produtoIds.filter(
                (id) => id !== produtoId
              ),
              produtos: slot.produtos.filter(
                (produto) => produto.id !== produtoId
              ),
            }
          : slot
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSavedMessage('');

    const valor = slots
      .filter((slot) => slot.categoria)
      .map((slot) => ({
        categoria: slot.categoria,
        produto_ids: slot.produtoIds,
      }));

    const { error: saveError } = await supabase
      .from('conteudo_site')
      .upsert({
        chave: 'destaques',
        valor,
        updated_at: new Date().toISOString(),
        updated_by: session.user.id,
      });

    setSaving(false);

    if (saveError) {
      console.error(saveError);
      setError('Não foi possível salvar os destaques.');
      return;
    }

    setSavedMessage('Destaques da Home atualizados.');

    window.setTimeout(() => {
      setSavedMessage('');
    }, 3000);
  }

  if (loading) {
    return (
      <div className="admin2-empty-state">
        Carregando destaques...
      </div>
    );
  }

  return (
    <section className="admin2-highlights">
      <div className="admin2-section-heading">
        <div>
          <h2>Destaques</h2>
          <p>
            Escolha até {ADMIN2_MAX_HIGHLIGHT_CATEGORIES} categorias
            e até {ADMIN2_MAX_HIGHLIGHT_PRODUCTS} produtos em cada
            uma para a vitrine da página inicial.
          </p>
        </div>

        <button
          type="button"
          className="admin2-primary-button"
          onClick={addSlot}
          disabled={
            slots.filter((slot) => slot.categoria).length >=
            ADMIN2_MAX_HIGHLIGHT_CATEGORIES
          }
        >
          + Adicionar vitrine
        </button>
      </div>

      {error && (
        <div className="admin2-form-error">
          {error}
        </div>
      )}

      {savedMessage && (
        <div className="admin2-highlight-success">
          {savedMessage}
        </div>
      )}

      {slots.length === 0 ? (
        <div className="admin2-empty-state">
          Nenhuma vitrine de destaque configurada.
        </div>
      ) : (
        <div className="admin2-highlights-list">
          {slots.map((slot, index) => (
            <Admin2HighlightSlot
              key={index}
              slot={slot}
              index={index}
              categorias={categorias}
              categoriasUsadas={categoriasUsadas}
              onChangeCategoria={changeCategoria}
              onRemove={removeSlot}
              onAddProduto={addProduto}
              onRemoveProduto={removeProduto}
            />
          ))}
        </div>
      )}

      <div className="admin2-highlights-save">
        <span>
          As alterações só entram na Home depois de salvar.
        </span>

        <button
          type="button"
          className="admin2-primary-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Salvando...' : 'Salvar destaques'}
        </button>
      </div>
    </section>
  );
}



function BannersSection() {
  const { session } = useAuth();

  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadBanners() {
      setLoading(true);
      setError('');

      const { data, error: loadError } = await supabase
        .from('conteudo_site')
        .select('valor')
        .eq('chave', 'banners')
        .maybeSingle();

      if (cancelled) return;

      if (loadError) {
        console.error(loadError);
        setError('Não foi possível carregar os banners.');
        setBanners([]);
      } else {
        setBanners(Array.isArray(data?.valor) ? data.valor : []);
      }

      setLoading(false);
    }

    loadBanners();

    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(next) {
    setSaving(true);
    setError('');

    const { error: saveError } = await supabase
      .from('conteudo_site')
      .upsert({
        chave: 'banners',
        valor: next,
        updated_at: new Date().toISOString(),
        updated_by: session.user.id,
      });

    if (saveError) {
      console.error(saveError);
      setError('Não foi possível salvar a alteração.');
      setSaving(false);
      return false;
    }

    setBanners(next);
    setSaving(false);

    return true;
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const url = await uploadAdmin2ContentImage(
        session,
        file,
        'banners'
      );

      await persist([...banners, url]);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          'Não foi possível enviar o banner.'
      );
    } finally {
      setUploading(false);
    }
  }

  async function moveBanner(index, direction) {
    const targetIndex = index + direction;

    if (
      targetIndex < 0 ||
      targetIndex >= banners.length ||
      saving
    ) {
      return;
    }

    const next = [...banners];

    [next[index], next[targetIndex]] = [
      next[targetIndex],
      next[index],
    ];

    await persist(next);
  }

  async function removeBanner(index) {
    const confirmed = window.confirm(
      'Remover este banner da página inicial?'
    );

    if (!confirmed || saving) return;

    await persist(
      banners.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  if (loading) {
    return (
      <div className="admin2-empty-state">
        Carregando banners...
      </div>
    );
  }

  return (
    <section className="admin2-banners">
      <div className="admin2-section-heading">
        <div>
          <h2>Banners</h2>
          <p>
            Banners rotativos exibidos na página inicial,
            logo abaixo de “Monte seu Catálogo”.
          </p>
        </div>

        <label
          className={`admin2-banner-upload-button ${
            uploading || saving ? 'is-disabled' : ''
          }`}
        >
          <span>
            {uploading ? 'Enviando...' : '+ Novo banner'}
          </span>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            disabled={uploading || saving}
            hidden
          />
        </label>
      </div>

      <div className="admin2-banner-hint">
        <strong>Tamanho recomendado:</strong>{' '}
        proporção larga 1140 × 340 px ou equivalente.
        A ordem abaixo é a ordem de exibição no carrossel.
      </div>

      {error && (
        <div className="admin2-form-error">
          {error}
        </div>
      )}

      {banners.length === 0 ? (
        <div className="admin2-empty-state">
          Nenhum banner cadastrado.
        </div>
      ) : (
        <div className="admin2-banners-list">
          {banners.map((src, index) => (
            <div
              className="admin2-banner-card"
              key={`${src}-${index}`}
            >
              <div className="admin2-banner-preview">
                <img
                  src={src}
                  alt={`Banner ${index + 1}`}
                />
              </div>

              <div className="admin2-banner-info">
                <strong>Banner {index + 1}</strong>

                <span>
                  {index === 0
                    ? 'Primeiro a aparecer'
                    : `Posição ${index + 1}`}
                </span>
              </div>

              <div className="admin2-banner-actions">
                <button
                  type="button"
                  className="admin2-secondary-button"
                  onClick={() => moveBanner(index, -1)}
                  disabled={index === 0 || saving}
                  title="Mover para cima"
                >
                  ↑
                </button>

                <button
                  type="button"
                  className="admin2-secondary-button"
                  onClick={() => moveBanner(index, 1)}
                  disabled={
                    index === banners.length - 1 || saving
                  }
                  title="Mover para baixo"
                >
                  ↓
                </button>

                <button
                  type="button"
                  className="admin2-link-button is-danger"
                  onClick={() => removeBanner(index)}
                  disabled={saving}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InstagramSection() {
  const { session } = useAuth();

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadInstagram() {
      setLoading(true);
      setError('');

      const { data, error: loadError } = await supabase
        .from('conteudo_site')
        .select('valor')
        .eq('chave', 'instagram')
        .maybeSingle();

      if (cancelled) return;

      if (loadError) {
        console.error(loadError);
        setError('Não foi possível carregar as imagens do Instagram.');
        setImages([]);
      } else {
        setImages(Array.isArray(data?.valor) ? data.valor : []);
      }

      setLoading(false);
    }

    loadInstagram();

    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(next) {
    setSaving(true);
    setError('');

    const { error: saveError } = await supabase
      .from('conteudo_site')
      .upsert({
        chave: 'instagram',
        valor: next,
        updated_at: new Date().toISOString(),
        updated_by: session.user.id,
      });

    if (saveError) {
      console.error(saveError);
      setError('Não foi possível salvar a alteração.');
      setSaving(false);
      return false;
    }

    setImages(next);
    setSaving(false);

    return true;
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const url = await uploadAdmin2ContentImage(
        session,
        file,
        'instagram'
      );

      await persist([...images, url]);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          'Não foi possível enviar a imagem.'
      );
    } finally {
      setUploading(false);
    }
  }

  async function moveImage(index, direction) {
    const targetIndex = index + direction;

    if (
      targetIndex < 0 ||
      targetIndex >= images.length ||
      saving
    ) {
      return;
    }

    const next = [...images];

    [next[index], next[targetIndex]] = [
      next[targetIndex],
      next[index],
    ];

    await persist(next);
  }

  async function removeImage(index) {
    const confirmed = window.confirm(
      'Remover esta imagem da seção de Instagram?'
    );

    if (!confirmed || saving) return;

    await persist(
      images.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  if (loading) {
    return (
      <div className="admin2-empty-state">
        Carregando imagens...
      </div>
    );
  }

  return (
    <section className="admin2-instagram">
      <div className="admin2-section-heading">
        <div>
          <h2>Instagram</h2>
          <p>
            Imagens exibidas na seção “Acompanhe — Siga a Ori no Instagram”
            da página inicial.
          </p>
        </div>

        <label
          className={`admin2-banner-upload-button ${
            uploading || saving ? 'is-disabled' : ''
          }`}
        >
          <span>
            {uploading ? 'Enviando...' : '+ Nova imagem'}
          </span>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            disabled={uploading || saving}
            hidden
          />
        </label>
      </div>

      <div className="admin2-banner-hint">
        <strong>Tamanho recomendado:</strong>{' '}
        proporção 4×5, como 1080 × 1350 px.
        A ordem abaixo é a ordem de exibição na página inicial.
      </div>

      {error && (
        <div className="admin2-form-error">
          {error}
        </div>
      )}

      {images.length === 0 ? (
        <div className="admin2-empty-state">
          Nenhuma imagem cadastrada.
        </div>
      ) : (
        <div className="admin2-instagram-grid">
          {images.map((src, index) => (
            <div
              className="admin2-instagram-card"
              key={`${src}-${index}`}
            >
              <div className="admin2-instagram-preview">
                <img
                  src={src}
                  alt={`Imagem ${index + 1} do Instagram`}
                />
              </div>

              <div className="admin2-instagram-card-footer">
                <div className="admin2-instagram-info">
                  <strong>Imagem {index + 1}</strong>
                  <span>
                    {index === 0
                      ? 'Primeira a aparecer'
                      : `Posição ${index + 1}`}
                  </span>
                </div>

                <div className="admin2-instagram-actions">
                  <button
                    type="button"
                    className="admin2-secondary-button"
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0 || saving}
                    title="Mover para cima"
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    className="admin2-secondary-button"
                    onClick={() => moveImage(index, 1)}
                    disabled={
                      index === images.length - 1 || saving
                    }
                    title="Mover para baixo"
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    className="admin2-link-button is-danger"
                    onClick={() => removeImage(index)}
                    disabled={saving}
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Admin2() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [activeSection, setActiveSection] = useState(() => {
    return sessionStorage.getItem('ori_admin2_section') || 'overview';
  });

  useEffect(() => {
    sessionStorage.setItem('ori_admin2_section', activeSection);
  }, [activeSection]);

  const meta = SECTION_META[activeSection];

  return (
    <div className="admin2-page">
      <aside className="admin2-sidebar">
        <div className="admin2-brand">
          <img src="/assets/logo.png" alt="Ori" />
          <div>
            <strong>Painel Admin</strong>
            <span>Gestão Ori</span>
          </div>
        </div>

        <nav className="admin2-nav">
          {NAV_ITEMS.map((item, index) => {
            if (item.section) {
              return (
                <div className="admin2-nav-section" key={`${item.section}-${index}`}>
                  {item.section}
                </div>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                className={`admin2-nav-item ${activeSection === item.key ? 'is-active' : ''}`}
                onClick={() => setActiveSection(item.key)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          className="admin2-back-site"
          onClick={() => navigate('/')}
        >
          ← Voltar ao site
        </button>
      </aside>

      <div className="admin2-main">
        <header className="admin2-header">
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>

          <div className="admin2-account">
            <span className="admin2-account-avatar">
              {(profile?.nome || session?.user?.email || 'A')
                .charAt(0)
                .toUpperCase()}
            </span>

            <div>
              <strong>
                {profile?.nome ||
                  session?.user?.user_metadata?.full_name ||
                  session?.user?.email?.split('@')[0] ||
                  'Administrador'}
              </strong>
              <span>{session?.user?.email || ''}</span>
            </div>
          </div>
        </header>

        <main className="admin2-content">
          
          {activeSection === 'overview' && <OverviewSection />}
          
          {activeSection === 'products' && <ProductsSection />}

          {activeSection === 'categories' && <CategoriesSection />}

          {activeSection === 'highlights' && <HighlightsSection />}

          {activeSection === 'banners' && <BannersSection />}

          {activeSection === 'instagram' && <InstagramSection />}

          {activeSection === 'users' && <UsersSection />}

          {activeSection === 'selections' && <SelectionsSection />}

          {activeSection === 'leads' && <LeadsSection />}

          {activeSection !== 'overview' &&
            activeSection !== 'products' &&
            activeSection !== 'categories' &&
            activeSection !== 'highlights' &&
            activeSection !== 'banners' &&
            activeSection !== 'instagram' &&
            activeSection !== 'users' &&
            activeSection !== 'selections' &&
            activeSection !== 'leads' && (
              <div className="admin2-section-placeholder">
                <h2>{meta.title}</h2>
                <p>Esta seção será construída em seguida.</p>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}
