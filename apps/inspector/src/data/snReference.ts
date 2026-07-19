// SN-referentie: hoe lees je per merk het serienummer af (bouwjaar/-dag).
// Overgenomen uit klimkeurpro (store.js SN_DATA, wens Jos 2026-07-19).
// Legenda: Y=jaar, M=maand, D=dag(nummer), W=week, x=overig cijfer, #=letter.
//
// De PDF-verwijzingen uit de oude app (bestanden in de oude storage) zijn
// bewust niet meegenomen; alleen echte, openbare links bleven staan. Het
// beoogde einddoel is dat de handleiding-link per merk uit de catalogus
// (products.manual_url) komt. Beheer van deze lijst kan later naar de
// platform-admin (zoals in de oude app); tot dan is dit de ene bron.

export interface SnReferenceEntry {
  brand: string
  example: string
  format: string
  note?: string
  link?: string
}

export const SN_REFERENCE: SnReferenceEntry[] = [
  { brand: 'ART', example: '21,1601001', format: 'xxYYxx xxx' },
  { brand: 'CT-Climbing', example: '2211-122-22', format: 'xxxx-DDD-YY' },
  { brand: 'DMM', example: '210321234E', format: 'YYDDDxxxx#', link: 'https://dmmwales.com/pages/dmm-product-markings-and-packaging' },
  { brand: 'Edelrid', example: 'verschilt', format: 'MMYY-xx-xxx-xxxx' },
  { brand: 'FallSave', example: '121844', format: 'MM/YYYY' },
  { brand: 'ISC', example: '22/45654/1234', format: 'YY/xxxxx/xxx', link: 'https://www.iscwales.com/News/Blog/New-Serial-Numbering-Implementation/' },
  { brand: 'Kask', example: '21,1234567.1234', format: 'YY.xxxxxxx.xxxx' },
  { brand: 'Kask', example: '21,1234,5678', format: 'YY.xxxx.xxxx' },
  { brand: 'Kong', example: '456218 22 6543', format: 'xxxxxxYYxxxx' },
  { brand: 'Kong connectors', example: '123456 2206 1234', format: 'xxxxxxMMYYxxxx' },
  { brand: 'Miller by Honeywell', example: '23/20 123415678/005', format: 'WWYYxxxxxx' },
  { brand: 'Petzl', example: '18E45654123', format: 'YYMxxxxxx' },
  { brand: 'Petzl pre-2016', example: '12122AV6543', format: 'YYDDDxxxxxx' },
  { brand: 'RockExotica', example: '22123A001', format: 'YYDDDaxxx' },
  { brand: 'Simond', example: '010622', format: 'xxMMYY', link: 'https://www.simond.com/user-guide-connectors-quickdraw-straps#80f2999d-56a1-4258-a3d1-289397b08731' },
  { brand: 'Taz', example: 'S01 220629 0001', format: 'xxxYYMMDDxxxx' },
  { brand: 'Tractel', example: 'DEM202000001', format: 'bij f: YY/MM' },
  { brand: 'TreeRunner / LACD', example: 'productiejaar = laatste 2 cijfers van het lotnummer', format: 'xxxxYY' },
  { brand: 'XSPlatforms', example: 'verschilt', format: '' },
]
