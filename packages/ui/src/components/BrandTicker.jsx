/**
 * Tulisan berjalan "JOKAM TRANS" — penghubung visual antara beranda
 * dan section jadwal. Dekoratif, jadi disembunyikan dari pembaca layar.
 */
const ITEMS = 8

export default function BrandTicker() {
  const items = Array.from({ length: ITEMS }, (_, i) => i)

  return (
    <div className="brand-ticker" aria-hidden="true">
      <div className="brand-ticker__track">
        {items.map((i) => (
          <span className="brand-ticker__item" key={`a-${i}`}>
            JOKAM TRANS
            <i className="brand-ticker__dot" />
          </span>
        ))}
        {items.map((i) => (
          <span className="brand-ticker__item" key={`b-${i}`}>
            JOKAM TRANS
            <i className="brand-ticker__dot" />
          </span>
        ))}
      </div>
    </div>
  )
}
