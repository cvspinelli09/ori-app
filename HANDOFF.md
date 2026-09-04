# Handoff — Projeto Ori Auto Peças (App + Site)

> Gerado em 2026-08-25 pra retomar num chat novo. Cole isto como primeira mensagem (ou peça pro Claude ler este arquivo inteiro antes de fazer qualquer coisa).

## 1. Quem é quem

- **Cliente**: Ori Indústria de Auto Peças LTDA — contato Roberto Guell.
- **Fornecedor**: Cristian Spinelli (usuário desta sessão, cvillaverde09@gmail.com).
- **Site atual do cliente**: `ori.com.br` (site legado — Apache + PHP + AngularJS, mantido pela agência "Centersite") — **precisa continuar no ar** durante todo o desenvolvimento, só será substituído perto do fim, com muito cuidado (ver seção 7).
- **Pasta do projeto**: `ori-demo/` dentro de `surveying-sales-system/`. Git local, remoto em `github.com/cvspinelli09/ori-app` (branch `main`) — **este projeto pode ficar público no GitHub**, diferente dos outros projetos do usuário.

## 2. Escopo (proposta comercial)

Arquivo original: `C:\Users\Spinelli\Documents\CHEN HSONG\TESTES APLICATIVO\ORI AUTO PEÇAS APP\proposta-ori-v3.docx` (31/07/2026). R$ 8.000 fechado (50%+50%), manutenção R$ 450/mês depois.

1. Site institucional (home + "Monte seu Catálogo")
2. App Web — busca/seleção por marca, categoria, linha
3. **Painel administrativo** — cadastro/edição contínua de produtos + importação CSV inicial
4. Captura de fotos em lote
5. **Geração de catálogo em PDF** — capa, agrupado por linha/marca
6. **Autenticação** — Google OU e-mail com código
7. **Login pros ~20 vendedores** + painel de acompanhamento de atividade
8. Captura de leads em lista exportável
9. Preparação pra cadastro de clientes e preços comerciais (futuro)

Fora de escopo: orçamentos pelo app, processamento de pedidos.

## 3. Stack e onde tudo mora

**Decidido e em uso**: React (Vite, JS puro — **nunca TypeScript, nunca Python**) + Node/Express + Supabase (Postgres + Auth) + Cloudflare R2 (fotos) + Resend (e-mail transacional). Tudo em contas **free tier** — combinado explicitamente ficar grátis até perto da produção.

| Peça | Onde | Status |
|---|---|---|
| Frontend | `ori-demo/webapp/` (React+Vite) | Em construção, ver seção 4 |
| Backend leve | `ori-demo/api/` (Node/Express, porta 3001) | `/health`, `/contact`, `/upload` prontos |
| Banco | Supabase projeto `ORI-APP`, `hqrnknyikgvasdiczsgs.supabase.co`, região São Paulo | Schema + dados populados |
| Fotos | Cloudflare R2, bucket `ori-fotos` | 12.832 fotos migradas |
| E-mail | Resend (`re_...` em `api/.env`) | Funcionando, ver limitação abaixo |
| Auth | Supabase Auth (Google OAuth + e-mail OTP) | Google em modo "Teste" |

**Credenciais**: todas em `webapp/.env` e `api/.env` (não versionados, no `.gitignore`). Ver `.env.example` de cada pasta pra saber quais variáveis existem. Se abrir um chat novo sem acesso a esses arquivos, pedir pro usuário confirmar que ainda existem antes de reconfigurar do zero.

**Site estático legado** (`index.html`, `catalogo.html`, `admin-destaque.html`, `home.html`, `login.html`, `server.js`, na raiz de `ori-demo/`): serviu de protótipo/referência visual pra tudo o que foi portado. **Não editar mais** — só consultar se precisar conferir como algo funcionava no design aprovado.

## 4. Estado atual do `webapp/` (React)

| Página/rota | Status |
|---|---|
| `/` (Home) | ✅ Completa: hero, CTA, carrossel de banner, categorias, "quem somos", vitrine de destaques (dados reais), Instagram+lightbox, formulário de contato (envia e-mail de verdade), footer. Responsivo mobile/tablet/desktop testado. |
| `/login` | ✅ Completa: Google OAuth + e-mail/OTP. |
| `/catalogo` | ✅ Completa: busca, 7 filtros, grid de produtos (6 col desktop), modal de detalhe com galeria e aplicação veicular, lightbox de foto. Header refinado (ver histórico). |
| `/catalogo/pdf` | ✅ Completa: gera o catálogo em PDF (via `window.print()`, não é PDF server-side) — capa, agrupado por linha/marca/categoria, paginação automática. Funciona pro catálogo completo ou pra uma seleção filtrada. |
| `/admin` | 🔶 Em construção. Abas **Produtos**, **Destaques**, **Banners** e **Instagram** ✅ completas e testadas com login real. Ver histórico 2026-08-25 pros detalhes. |
| `/vendedor` | ❌ Não iniciada — só o shell vazio. |

## 5. Próximos passos (em ordem sugerida)

1. ~~Testar o Admin/Produtos com login real~~ ✅ Feito em 2026-08-25 — ver seção 6 (bug do GRANT) e histórico.
2. ~~Aba Destaques do admin~~ ✅ Feito em 2026-08-25 — Home lê de `conteudo_site` (chave `destaques`), fallback pra lista fixa se ainda vazio.
3. ~~Abas Banners e Instagram do admin~~ ✅ Feito em 2026-08-25 — upload/reordenar/remover, `conteudo_site` chaves `banners`/`instagram`, Home lendo de lá.
4. **[PAUSADO — aguardando confirmação do cliente, 2026-08-25]** Layout novo do catálogo PDF: quebra de página só por Linha (Leve/Van/Pesada — 3 quebras "duras" no total), Marca vira banner interno grafite (`#2c2c2a`), Categoria continua banner vermelho — elimina o desperdício de página quase vazia que acontecia a cada troca de marca hoje. Mockups aprovados no visual (ver histórico 2026-08-25). Inclui também uma **contracapa fixa** no final do catálogo (arte pronta, o usuário mandou em `C:\Users\Spinelli\Downloads\ORI - Contracapa.pdf` — **ainda não copiada pro projeto**, precisa mover pra `ori-demo/assets/` ou `webapp/public/assets/` antes de implementar) em vez da página quase-vazia atual; campo "Representante:" na contracapa fica **em branco por padrão**, mas plano é auto-preencher com nome/e-mail do vendedor logado assim que o Painel do Vendedor (item 5 abaixo) existir — `profiles` já tem `nome`/`email`, só falta `telefone` se quiserem incluir. **Não implementar no código ainda** — usuário vai confirmar com o cliente (incluindo a decisão sobre logins de vendedor) antes de seguir.
5. **Painel do Vendedor** — login individual pros ~20 vendedores + acompanhamento de atividade (nada feito ainda; "o que conta como atividade" também ainda não foi definido com o usuário). Decisões já tomadas em 2026-08-25 (aguardando só confirmação do cliente, junto com o item 4):
   - Vendedor **não se auto-cadastra** — conta é criada pelo admin (diretor ou quem ele autorizar) com dados estruturados (nome completo, telefone, e-mail), não por login solto do Google (que não traz telefone e pode trazer nome "errado" da conta pessoal).
   - Isso vira uma aba nova **"Vendedores"** dentro do Admin existente (mesma proteção `role = 'admin'` que já protege `/admin` — sem nível de permissão novo) — só o admin cria/edita/desativa vendedor; o vendedor nunca vê essa aba, só o painel dele próprio depois de logado.
   - Precisa de coluna nova `telefone` em `profiles` (hoje só tem `nome`/`email`).
   - Login do vendedor em si continua pelo fluxo já existente (e-mail + código OTP), só a *criação* da conta que muda de mãos.
6. **Captura de lead** no fluxo de "Baixar catálogo em PDF" (item da proposta, ainda não implementado).
7. **Criar os ~20 usuários vendedores** de verdade (Supabase Auth + `profiles.role = 'vendedor'`).
8. Rever os produtos marcados `aplicacao_revisar = true` (~1030 produtos com aplicação veicular extraída automaticamente, não confirmada) — precisa de UI no admin pra filtrar/revisar isso.
9. Quando estiver perto do fim: domínio (`app.ori.com.br`), publicar o app Google (sair do modo "Teste"), verificar domínio no Resend pra poder mandar e-mail pra `vendas2@ori.com.br`. Ver seção 7.
10. **[AVISADO, NÃO INICIAR — 2026-08-25]** Redesign só da seção **hero** da Home (`Home.jsx`) — não o header/nav, só confirmado o hero mesmo. Usuário mandou um mockup de referência: headline "Encontre as peças certas e monte seu catálogo em minutos", CTA duplo (Explorar catálogo / Montar meu catálogo), cards de estatística (SKUs/aplicações/catálogo atualizado/PDFs), mockup de laptop com callouts flutuantes (PDF personalizado, busca por código, aplicações, materiais). Só aviso por ora, sem código ainda — "provavelmente nos próximos dias". **Stats já combinados** (usuário confirmou em 2026-08-25, arredondados pra baixo a partir da contagem real do banco): **+3.500 SKUs**, **+3.600 aplicações**, **+380 veículos** (em vez do "+5.000 aplicações" que estava no mockup de referência, que não batia com o dado real de 3.623). Usar esses 3 números quando for implementar — não precisa reconfirmar.
11. **[AVISADO, NÃO INICIAR — 2026-08-25]** Redesign da página `/catalogo` também — o mesmo mockup mostrava, dentro da tela do laptop, um layout diferente do catálogo atual: sidebar com seções tipo "Produtos em destaque / Aplicações / Categorias / Lançamentos", busca por código destacada. Só aviso por ora, usuário vai avisar quando começar — não tem mockup detalhado ainda, só o que apareceu de relance na imagem de referência do hero (item 10).

## 6. Limitações conhecidas / pegadinhas pra lembrar

- **Servidor Node precisa estar rodando localmente** (`cd api && node --watch server.js`) pra formulário de contato e upload de foto funcionarem — ainda não tem deploy.
- **Resend sem domínio verificado**: só manda e-mail pro dono da conta (`villasales.cristian@gmail.com`). Pra mandar pra `vendas2@ori.com.br` precisa verificar `ori.com.br` no Resend (depende do DNS, ver seção 7).
- **Google OAuth em modo "Teste"**: só as 2 contas cadastradas como "usuário de teste" conseguem logar com Google. Publicar o app quando for a hora (mostra aviso "não verificado" até passar pela verificação do Google, que leva dias).
- **Catálogo sem paginação**: 3.515 produtos renderizados de uma vez geram uma página de ~126.000px no desktop. Funciona, mas é candidato natural a paginação/virtualização se o catálogo crescer (cliente mencionou poder chegar a +3.000 itens).
- **~940 produtos sem aplicação veicular** — a fonte de dados (planilha do cliente) genuinamente não tem ano pra esses, não dá pra preencher sem inventar.
- **Painel Admin**: só a aba Produtos existe. Nunca criar scroll vertical extra dentro do modal por causa de ajuste de layout — só é aceitável quando o conteúdo cresce de verdade (ex: usuário adicionando mais linhas de veículo).
- **GRANT em tabela nova precisa dos 4 verbos, não só SELECT**: `0003_grants.sql` só tinha dado `SELECT` em `produtos` pra `authenticated`, faltando `INSERT/UPDATE/DELETE` — mesmo com a RLS `produtos_write_admin` correta, o Postgres bloqueia antes de avaliar RLS sem o GRANT explícito (mesma pegadinha já registrada pra outras tabelas, ver histórico 2026-08-20/21). Corrigido em `0007_grants_produtos_write.sql`. **Lição**: ao criar uma tabela nova com política de escrita restrita por role, sempre conferir se o GRANT cobre todos os verbos que a política permite, não só os que foram testados primeiro.

## 7. Plano de domínio/deploy (decidido, não executado)

Ver memória `project_ori_dns_deploy_plan` se disponível, ou resumo aqui:
1. **Agora**: nada de DNS, só testes locais.
2. **Perto do lançamento**: subdomínio `app.ori.com.br` → deploy do React na **Vercel** (free tier), via **1 registro CNAME novo**. Não toca em mais nada — MX (e-mail do cliente) fica intocado, risco zero.
3. **Só depois de tudo aprovado**: trocar o domínio raiz (`ori.com.br`) do site antigo pro novo. Antes disso, exportar a zona DNS completa atual (backup). Trocar só o registro A/CNAME do domínio raiz — **nunca os nameservers inteiros** (isso arrastaria o e-mail junto e é onde costuma quebrar). Testar e-mail logo depois da troca.
- Domínio continua onde já está hoje — **não precisa mover pro HostGator** (o usuário tem conta lá, mas não é o lugar certo pra esse stack React/Node).
- O servidor Node (`api/`) vai precisar virar funções serverless da Vercel quando for pro deploy (ainda não feito).

## 8. Preferências e regras importantes do usuário

- **Stack**: React + JS puro + Node + Supabase/Postgres. Nunca TypeScript, nunca Python.
- **Tudo grátis até perto da produção** — free tier em todo serviço (Supabase, R2, Resend, Vercel).
- **Precisão de dados é prioridade máxima** — nunca "chutar" informação (nomes de veículo, valores) fora do que já está verificado. Sinalizar incerteza em vez de adivinhar. Quando a extração automática não tem 100% de certeza, ainda assim pode preencher (decisão explícita do usuário), mas sempre marcado com `aplicacao_revisar = true`, visível só no admin — nunca apresentado como fato definitivo pro cliente final.
- **Confirmar antes de agir** em mudanças de escopo maiores ou que afetem dado ao vivo — o usuário gosta de aprovar antes.
- **E-mail do cliente é sagrado** — qualquer mudança de DNS precisa de cautela extrema (ver seção 7). Nunca mexer em nameservers inteiros.
- Ao mexer em CSS/layout: testar de verdade no browser antes de reportar como pronto (várias vezes já apareceram bugs de especificidade CSS/cascata que só apareceram testando).

---

## Histórico detalhado (arquivado — consultar só se precisar entender o "porquê" de alguma decisão específica)

<details>
<summary>Expandir histórico completo por data</summary>

### 2026-08-20 — Decisões pendentes do cliente resolvidas
- 19 conflitos de código de conversão: cliente confirmou usar sempre o valor da planilha — já estava certo no banco.
- 44 produtos "DESCONTINUADO": 16 com presença no site → mantidos; 28 sem presença → fora do catálogo (já estava certo).
- 110 códigos "não encontrados": cliente mandou ignorar por ora (revisão futura) — já estavam fora.
- Nota ambígua "Deamis pode Cancelar" no código 8103 era erro de leitura — na verdade "**Demais** pode Cancelar", confirmando que o grupo Audi A3 (8100-8103) mantém todos.

### 2026-08-20/21 — Scaffold do backend
- `supabase/migrations/0001_init.sql` — schema completo (profiles, produtos, leads, vendedor_atividade, conteudo_site, tudo com RLS).
- `webapp/` (Vite+React) e `api/` (Node/Express) criados do zero.
- Projeto Supabase `ORI-APP` criado (São Paulo, free tier). Migrations 0002-0004 corrigiram recursão de RLS e grants faltando (`anon`/`authenticated`/`service_role` precisam de GRANT explícito na tabela, separado do RLS — pegadinha real do Postgres/PostgREST, mais o `NOTIFY pgrst, 'reload schema'` necessário depois de cada GRANT).
- 3.515 produtos importados via `api/scripts/import-products.js`.

### 2026-08-21 — Fotos no Cloudflare R2
- Supabase Storage (1GB grátis) não comportava as 2,1GB de fotos (12.832 arquivos) — decidido Cloudflare R2 (10GB grátis, sem cobrança de tráfego).
- Bucket `ori-fotos`, Public Development URL habilitada, API Token restrito ao bucket.
- Todas as fotos migradas (`api/scripts/upload-photos-to-r2.js`), URLs atualizadas no banco (`0005_photo_urls_to_r2.sql`).

### 2026-08-21 — Visual portado pro React
- Header, Home, Login, Catálogo ganharam o design do site estático aprovado, ligados no Supabase real.
- Bug corrigido: Max Rows do Supabase Data API em 1000 (padrão) cortava o catálogo pela metade — subido pra 5000. **Não é solução infinita** — se crescer muito mais, precisa paginação de verdade.
- Seções que tinham ficado de fora numa primeira passada (usuário notou): carrossel de banner, vitrine de destaques, Instagram+lightbox, formulário de contato+mapa — todas portadas depois.
- Link "Abrir no Maps" dentro do iframe do Google não funcionava (limitação do embed simples, não regressão) — adicionado link externo "Ver no Google Maps →" como alternativa confiável.

### 2026-08-21 — Login Google configurado
- Google Cloud: projeto `Ori-App`, tela de consentimento OAuth externa, Client OAuth com redirect pro Supabase. Provider habilitado no Supabase Auth. Testado e funcionando.
- App Google fica em modo "Teste" até decidirem publicar (aviso "não verificado" até passar pela verificação do Google).

### 2026-08-21 — Geração de PDF
- Descoberta: o "PDF" do demo original não é gerado no servidor — é uma página HTML estilizada pra impressão A4 + `window.print()`. Portado exatamente assim pro React (`/catalogo/pdf`), usando dados reais do Supabase. Testado com catálogo completo e com seleção filtrada.

### 2026-08-21 — Qualidade de dados: aplicação veicular
- Trabalho de extração de veículo+ano (de uma sessão anterior, nunca importado) estava em `assets/cadastro/Ori - Descricoes Completas.xlsx`.
- Processo rigoroso (dry-run, validações, backup, amostra revisada) aplicado em 2 passadas:
  1. `api/scripts/fix-fill-aplicacoes.js` — 825 produtos corrigidos/preenchidos com segurança validada (contagem de veículo batendo entre descrição e extração).
  2. `api/scripts/fill-aplicacoes-permissivo.js` — mais 205 produtos, com tolerância a imprecisão menor (decisão explícita do usuário: aplicação levemente errada é baixo risco, diferente de dado corrompido).
- `api/scripts/clear-remaining-corrupted.js` — limpou 164 produtos que ainda tinham o bug de encoding antigo (caracteres tipo "È", "藺4l") sem dado limpo disponível pra substituir. **0 produtos corrompidos restantes** no catálogo inteiro.
- Tentativa de recuperar veículos "esquecidos" via detecção automática (comparando descrição × aplicação extraída) foi **abandonada** — gerava muito falso positivo (nome de peça confundido com veículo). Só aplicada como exceção pontual verificada à mão pros códigos 1088-1091 (Quantum).
- **Total: 2.575 de 3.515 produtos (~73%) com aplicação preenchida.** ~940 continuam vazios por falta de dado na fonte (não é bug, é ausência real).
- Nova coluna `aplicacao_revisar` (boolean) marca o que veio de extração automática — visível só no admin, nunca pro cliente final.

### 2026-08-21 — Refinamento de layout do Catálogo
- Header foi de 6 linhas até o primeiro produto pra 3, via sessão de mockups (`mcp__visualize`) antes de implementar — evitou ciclos de código descartado.
- Vários bugs reais de CSS encontrados e corrigidos: especificidade de seletor fazendo regra vencer errado (2x — uma no botão de PDF mobile/desktop, outra no menu mobile do Header que ficava "grudado" aberto ao alargar a janela), grid de colunas desigual por `1fr` sem `minmax(0,1fr)`.
- Desktop: filtros em grid de 7 colunas, depois grade de produtos fixada em 6 colunas (ajuste visual pedido pelo usuário).

### 2026-08-22 — E-mail real no formulário de contato
- `mailto:` não funcionava pro usuário (sem programa de e-mail padrão configurado) — mesma coisa aconteceria com clientes reais.
- Trocado por envio via servidor: conta Resend criada, endpoint `POST /contact` no `api/server.js`, testado ponta a ponta (e-mail chegou).

### 2026-08-25 — Painel Admin, aba Produtos
- Contas `cvspinelli09@gmail.com` e `villasales.cristian@gmail.com` promovidas a `admin` no banco.
- `api/server.js` ganhou middleware `requireAdmin` (valida token Supabase + role) e endpoint `POST /upload` (multer + R2) — usado pra foto de produto, reaproveitável pra Banners/Instagram depois.
- Aba Produtos do admin construída: busca, lista, modal de novo/editar com upload de foto real, veículos compatíveis (múltiplas linhas), salva no Supabase de verdade.
- Ajustes de layout pedidos pelo cliente aplicados: código de conversão virou campo único (saiu de dentro de cada linha de veículo), modal alargado pra 780px (uso é majoritariamente desktop), Peso líquido/Código de barras em proporção 40/60, foto de preview aumentada de 64px pra 80px sem gerar scroll.
- Regra combinada: scroll vertical no modal só é aceitável quando o conteúdo cresce de verdade (mais linhas de veículo adicionadas), nunca por causa de ajuste de layout estático.
- **Ainda não testado com login real** — só via rota de bypass temporária (removida depois de cada teste).

### 2026-08-25 — Painel Admin, aba Produtos testada com login real
- Teste feito com produto propositalmente fora de contexto (código Ori `57575`, Honda/Atuadores, descrição "TESTE DE INSERÇÃO...") pra ficar fácil de achar e remover — apareceu certo no catálogo e no PDF.
- Bug real encontrado: `insert` em `produtos` retornava `permission denied for table produtos`. Causa: `0003_grants.sql` só tinha `grant select` pra `authenticated`, faltando `insert/update/delete` (a RLS `produtos_write_admin` já estava certa, mas GRANT e RLS são camadas independentes no Postgres). Corrigido com `0007_grants_produtos_write.sql`, aplicado manualmente no SQL Editor do Supabase e verificado via `aclexplode(relacl)` em `pg_class` (a view `information_schema.role_table_grants` não mostrou nada, provavelmente por rodar como owner — não confiável pra essa checagem).
- Adicionado botão **"← Voltar ao site"** no header do admin (`Admin.jsx`, link pra `/`).
- Adicionado botão **Excluir** em cada linha da lista de produtos (fazia falta — só tinha Editar), com `window.confirm` antes de deletar.
- Aba Produtos considerada **completa e testada** (cadastro, edição, exclusão, upload de foto, navegação) — fechada por ora.

### 2026-08-25 — Painel Admin, abas Destaques/Banners/Instagram
- **Destaques**: nova aba no admin — até 5 categorias, até 3 produtos por categoria (busca já mostra lista de produtos daquela categoria assim que escolhida, não só depois de digitar). Salva em `conteudo_site` (chave `destaques`, valor `[{categoria, produto_ids}]`). Mesma pegadinha de GRANT do item anterior encontrada de novo em `conteudo_site` (só tinha SELECT) — corrigida em `0008_grants_conteudo_site_write.sql`.
- Home (`Home.jsx`) passou a ler a vitrine "Produtos em destaque" de `conteudo_site` em vez da lista fixa `DEFAULT_DESTAQUE_CATEGORIAS` — mantém fallback pra lista antiga se ainda não configurado.
- **Banners e Instagram**: duas abas novas, ambas usando um componente genérico `ImageListTab` (upload via `POST /upload` já existente, reordenar ↑/↓, remover), salvando em `conteudo_site` chaves `banners`/`instagram` — mesmo padrão key-value, mesmo GRANT do item acima já cobre.
- Home também passou a ler banners (`TopBanner`) e fotos do Instagram de `conteudo_site`, com fallback pras imagens fixas antigas (`webapp/public/assets/banner_superior/`, `webapp/public/assets/instagram/`) enquanto nada for salvo.
- Extraído helper `uploadFile(session, file, folder)` em `Admin.jsx`, reaproveitado por Produtos/Banners/Instagram (antes só existia dentro de `ProdutosTab`).
- **Todas as 4 abas do admin (Produtos, Destaques, Banners, Instagram) consideradas completas e testadas** com login real.

### 2026-08-25 — Discussão do layout do catálogo PDF (mockups, ainda não implementado)
- Usuário baixou um catálogo filtrado real (`catalogo PDF Comutadores - Botões de Vidro - Elétrica.pdf`, 87 páginas) e notou muito espaço em branco: hoje (`CatalogoPdf.jsx`) cada nova **Marca** força página nova mesmo que a página anterior tenha sobrado espaço — só Categoria já "flui" dentro da mesma página de uma Marca.
- Decidido (aguardando cliente confirmar): trocar pra só 3 quebras de página "duras" (uma por **Linha** — Leve/Van/Pesada). Cabeçalho de página passa a mostrar só a Linha; **Marca** vira um banner interno (grafite `#2c2c2a`, escolhido de propósito pra não confundir com as cores azuis das 3 Linhas — primeira tentativa usou azul igual ao header da Linha Van e foi corrigida); Categoria continua o banner vermelho de hoje.
- Regra de implementação a respeitar quando for pro código de verdade: **nunca cortar um bloco (banner de Marca/Categoria + pelo menos 1 produto) entre páginas** — se não sobrar espaço suficiente, o bloco inteiro pula pra próxima página. Regra prática: não iniciar um novo grupo se sobrar menos de ~20% da página.
- 2 mockups produzidos: um via `mcp__visualize` (rascunho rápido pra alinhar o conceito), depois um HTML real com dimensões em mm idênticas ao `catalogo-pdf.css` de produção, convertido pra PDF via Playwright/Chromium (instalado no ambiente pra esse fim — `npx playwright install chromium`) — **medido programaticamente antes de gerar** (`content.bottom` vs `footer.top` via `page.evaluate`) pra garantir zero corte de conteúdo antes de mandar pro usuário. Primeira tentativa de mockup estourou a altura da página (~90px) porque tinha densidade de conteúdo demais — corrigido removendo 2 blocos de categoria por página até sobrar margem positiva em todas.
- **Contracapa fixa**: usuário vai substituir a página final quase-vazia atual por uma arte de contracapa própria — enviou o arquivo (`ORI - Contracapa.pdf`, 1 página apesar do sistema ter relatado "16 páginas" por engano — confirmado via `pdf-lib` que é 1 página só). Conteúdo: logo ORI, os 2 endereços/telefones reais (Ori Auto Peças + Ori Truck, batendo com os dados já usados na Home), e um campo "Representante:" com uma caixa em branco.
- Decisão sobre o campo "Representante": fica **em branco por padrão** por ora. Ideia de auto-preencher com nome/e-mail do vendedor logado é tecnicamente viável (`profiles` já tem `nome`/`email`) mas depende do Painel do Vendedor (ainda não construído) — registrada como próximo passo natural quando esse painel existir.
- **Nada disso foi implementado no `CatalogoPdf.jsx` ainda** — só mockups aprovados no visual. Usuário vai confirmar tudo com o cliente (layout + decisão de login de vendedor) antes de pedir a implementação de verdade.
- Ambiente ganhou 2 ferramentas novas pra esse tipo de tarefa: Playwright+Chromium (renderizar HTML→PDF) e `pdf-to-png-converter`+`pdf-lib` (renderizar PDF→PNG e ler metadados, já que este ambiente Windows não tem `poppler-utils`/`pdftoppm`).

</details>
