export function PdfFamilyPages({ pages }) {
  return pages.map((page) => <div className="pdf-page pdf-family-page" key={`${page.familia_id}:${page.id}`}>
    <img src={page.imagem_url} alt={page.titulo || page.familyName} />
  </div>);
}