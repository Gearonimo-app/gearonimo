import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage, type Color } from 'pdf-lib'
import QRCode from 'qrcode'
import { supabase } from '@gearonimo/core'
import { gearonimoMarkBytes } from './gearonimoMark'

// Genereert het certificaat-PDF bij het afronden van een keuring
// (DATAMODEL §certificates). Client-side gebouwd; de PDF wordt eenmalig
// vastgelegd in Storage en daarna nooit herschreven (onveranderlijkheid).
//
// De opmaak is per keurbedrijf instelbaar via inspection_companies.cert_layout
// (besluit Jos 2026-06-25). Dezelfde renderfunctie voedt zowel de echte
// generatie als de live preview in het instellingenscherm.

// ----------------------------------------------------------------------------
// Opmaak-configuratie (per keurbedrijf)
// ----------------------------------------------------------------------------

export interface CertLayout {
  orientation: 'portrait' | 'landscape' | 'auto' // auto = liggend als de tabel te breed wordt
  logoScale: number // 0.3–2.5, t.o.v. een basislogo-hoogte (~46pt)
  logoAlign: 'left' | 'center' | 'right'
  logoOffsetX: number // pt nudge naar links (–) / rechts (+)
  logoOffsetY: number // pt nudge: logo naar beneden (0 = bovenaan)
  headerOffsetY: number // pt nudge: bedrijfs-/certificaatgegevens naar beneden (0 = bovenaan)
  companyInfo: 'left' | 'right' // bedrijfsgegevens links of rechts in de kop
  showAddress: boolean
  showContact: boolean
  showRegistration: boolean // KvK/BTW tonen als ze ingevuld zijn
  accent: string // hex, kleur van titels en tabelkop
  // Optionele tabelkolommen aan/uit. Vaste kolommen (status/merk/artikel/
  // bouwjaar/serienummer) staan altijd aan en zitten hier niet in.
  columns: {
    category: boolean
    norm: boolean
    mbs: boolean
    user: boolean
    next: boolean
    note: boolean
  }
}

export const DEFAULT_CERT_LAYOUT: CertLayout = {
  orientation: 'auto',
  logoScale: 1,
  logoAlign: 'left',
  logoOffsetX: 0,
  logoOffsetY: 0,
  headerOffsetY: 0,
  companyInfo: 'left',
  showAddress: true,
  showContact: true,
  showRegistration: true,
  accent: '#1a3a2a',
  columns: { category: true, norm: false, mbs: false, user: true, next: true, note: true },
}

// Vul ontbrekende velden aan met de standaard, zodat oude/lege configs niet
// breken bij het toevoegen van nieuwe opties (ook de geneste columns-map).
export function resolveLayout(raw: unknown): CertLayout {
  const r = raw && typeof raw === 'object' ? (raw as Partial<CertLayout>) : {}
  return {
    ...DEFAULT_CERT_LAYOUT,
    ...r,
    columns: { ...DEFAULT_CERT_LAYOUT.columns, ...(r.columns || {}) },
  }
}

// ----------------------------------------------------------------------------
// Genormaliseerde invoer voor de renderer (losgekoppeld van de DB-vorm, zodat
// de preview met voorbeelddata exact dezelfde renderer kan gebruiken).
// ----------------------------------------------------------------------------

export interface CertCompany {
  name: string
  address: string | null
  postal_code: string | null
  city: string | null
  province: string | null
  email: string | null
  phone: string | null
  registration_number: string | null
  vat_number: string | null
  cert_header: string | null
  cert_footer: string | null
}

export interface CertItem {
  result: string
  brand: string | null
  name: string | null
  serial_number: string | null
  manufacture_year: number | null
  manufacture_month: number | null
  category: string | null
  norm: string | null
  mbs: string | null
  user: string | null
  next_due: string | null
  rejection_code_label: string | null
  comment: string | null
}

export interface CertData {
  company: CertCompany
  customerName: string
  inspectionDate: string // ISO
  inspectorName: string | null
  number: string
  verifyUrl: string
  items: CertItem[]
}

// ----------------------------------------------------------------------------
// Hulpfuncties
// ----------------------------------------------------------------------------

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
}

function hexToColor(hex: string): Color {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return rgb(0.1, 0.23, 0.16)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// Lichtere tint van een kleur (voor de tabelkop-achtergrond).
function tint(c: Color, factor: number): Color {
  const col = c as { red: number; green: number; blue: number }
  return rgb(
    col.red + (1 - col.red) * factor,
    col.green + (1 - col.green) * factor,
    col.blue + (1 - col.blue) * factor
  )
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Breekt tekst af op woordgrens binnen maxWidth; lange woorden worden hard
// gebroken. Geeft minstens één (mogelijk lege) regel terug.
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return ['']
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let cur = ''
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        cur = test
      } else if (!cur && font.widthOfTextAtSize(w, size) > maxWidth) {
        // Woord langer dan de kolom: hard breken op tekens.
        let chunk = ''
        for (const ch of w) {
          if (chunk && font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk)
            chunk = ch
          } else {
            chunk += ch
          }
        }
        cur = chunk
      } else {
        if (cur) lines.push(cur)
        cur = w
      }
    }
    if (cur) lines.push(cur)
  }
  return lines.length ? lines : ['']
}

// ----------------------------------------------------------------------------
// Tabel-kolommen
// ----------------------------------------------------------------------------

type ColumnKey = keyof CertLayout['columns']

interface ColDef {
  key: string
  header: string
  optional: boolean // aan/uit via cert_layout.columns; vaste kolommen staan altijd aan
  flex: boolean // mag groeien/krimpen om te passen
  min: number
  cap: number // voorkeur-maximum
  value: (it: CertItem) => string // lege string = geen waarde
}

function yearStr(it: CertItem): string {
  if (!it.manufacture_year) return ''
  return it.manufacture_month
    ? `${it.manufacture_year}/${String(it.manufacture_month).padStart(2, '0')}`
    : String(it.manufacture_year)
}
function noteStr(it: CertItem): string {
  if (it.result === 'passed') return ''
  return [it.rejection_code_label, it.comment].filter(Boolean).join(' — ')
}

// Alle mogelijke kolommen in vaste volgorde. Vaste kolommen
// (status/merk/artikel/bouwjaar/serienummer) staan altijd aan; de optionele zijn
// per keurbedrijf aan/uit te zetten. Een kolom verschijnt alleen als hij aan
// staat én minstens één artikel er data voor heeft ("alleen tonen als er iets in
// staat"); status is altijd zichtbaar. Uitgevinkt = data blijft bestaan maar
// staat niet op het certificaat.
const ALL_COLUMNS: ColDef[] = [
  { key: 'status',   header: 'Status',                 optional: false, flex: false, min: 62, cap: 80,  value: (it) => (it.result === 'passed' ? 'GOED' : 'AFGEKEURD') },
  { key: 'brand',    header: 'Merk',                   optional: false, flex: false, min: 56, cap: 120, value: (it) => it.brand || '' },
  { key: 'article',  header: 'Artikel',                optional: false, flex: true,  min: 80, cap: 190, value: (it) => it.name || '' },
  { key: 'year',     header: 'Bouwjaar',               optional: false, flex: false, min: 56, cap: 74,  value: yearStr },
  { key: 'sn',       header: 'Serienummer',            optional: false, flex: false, min: 64, cap: 120, value: (it) => it.serial_number || '' },
  { key: 'category', header: 'Categorie',              optional: true,  flex: false, min: 64, cap: 130, value: (it) => it.category || '' },
  { key: 'norm',     header: 'Norm',                   optional: true,  flex: false, min: 56, cap: 120, value: (it) => it.norm || '' },
  { key: 'mbs',      header: 'MBS',                    optional: true,  flex: false, min: 48, cap: 90,  value: (it) => it.mbs || '' },
  { key: 'user',     header: 'Gebruiker',              optional: true,  flex: false, min: 64, cap: 130, value: (it) => it.user || '' },
  { key: 'next',     header: 'Volgende keuring',       optional: true,  flex: false, min: 78, cap: 110, value: (it) => (it.next_due ? formatDate(it.next_due) : '') },
  { key: 'note',     header: 'Afkeurcode / opmerking', optional: true,  flex: true,  min: 90, cap: 240, value: noteStr },
]

const CELL_PAD = 6

// Welke kolommen daadwerkelijk getekend worden: aan + (status of er is data).
function activeColumns(items: CertItem[], cols: CertLayout['columns']): ColDef[] {
  return ALL_COLUMNS.filter((col) => {
    const enabled = col.optional ? !!cols[col.key as ColumnKey] : true
    if (!enabled) return false
    if (col.key === 'status') return true
    return items.some((it) => col.value(it).trim() !== '')
  })
}

// Toon lege cellen als streepje, behalve de opmerking-kolom (die blijft blank).
function cellText(col: ColDef, it: CertItem): string {
  const v = col.value(it)
  return v !== '' ? v : col.key === 'note' ? '' : '—'
}

// Voorkeursbreedte per kolom = max(kop, langste cel) + padding, afgetopt op cap.
function preferredWidths(items: CertItem[], cols: ColDef[], font: PDFFont, bold: PDFFont, size: number): number[] {
  return cols.map((col) => {
    let w = bold.widthOfTextAtSize(col.header, size)
    for (const it of items) w = Math.max(w, font.widthOfTextAtSize(col.value(it), size))
    return Math.min(col.cap, Math.max(col.min, w + CELL_PAD * 2))
  })
}

// Past de kolombreedtes op de beschikbare breedte: groeit de flex-kolommen als
// er ruimte over is, of schaalt alles proportioneel als het te breed is.
function fitWidths(pref: number[], cols: ColDef[], avail: number): number[] {
  const total = pref.reduce((a, b) => a + b, 0)
  if (total <= avail) {
    const flexIdx = cols.map((c, i) => (c.flex ? i : -1)).filter((i) => i >= 0)
    const extra = avail - total
    const per = extra / (flexIdx.length || 1)
    return pref.map((w, i) => (flexIdx.includes(i) ? w + per : w))
  }
  return pref.map((w) => (w * avail) / total)
}

// ----------------------------------------------------------------------------
// Renderer
// ----------------------------------------------------------------------------

export async function renderCertificatePdf(
  data: CertData,
  layout: CertLayout,
  logoBytes: Uint8Array | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const accent = hexToColor(layout.accent)
  const grey = rgb(0.42, 0.42, 0.42)
  const lineGrey = rgb(0.85, 0.85, 0.85)

  // Error-correctie 'H' zodat een (later) Gearonimo-logo in het midden van de
  // QR de scanbaarheid niet breekt.
  const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, { margin: 0, width: 200, errorCorrectionLevel: 'H' })
  const qrImage = await doc.embedPng(qrDataUrl)

  let logo: PDFImage | null = null
  if (logoBytes && logoBytes.length) {
    try {
      // PNG-signatuur (0x89 'P' 'N' 'G'); anders JPG proberen.
      logo = logoBytes[0] === 0x89 ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes)
    } catch {
      logo = null
    }
  }

  // Gearonimo-merk (platform), klein naast de verificatie-QR.
  let gearMark: PDFImage | null = null
  try {
    gearMark = await doc.embedJpg(gearonimoMarkBytes())
  } catch {
    gearMark = null
  }

  const margin = 50
  const tableSize = 9.5
  const items = data.items
  const cols = activeColumns(items, layout.columns)

  // Oriëntatie bepalen. Auto = staand, tenzij de tabel echt te breed wordt om
  // nog netjes in staand te passen (dan liggend). Staand is de natuurlijke keuze
  // voor de meeste keuringen; pas bij brede inhoud (lange opmerkingen bij
  // afkeuringen) loont liggend. De factor geeft staand wat speling: een artikel-
  // naam die op twee regels afbreekt is prima, daar hoeft het niet voor draaien.
  const A4_SHORT = 595.28
  const A4_LONG = 841.89
  const portraitAvail = A4_SHORT - 2 * margin
  const AUTO_LANDSCAPE_FACTOR = 1.2
  let landscape: boolean
  if (layout.orientation === 'landscape') landscape = true
  else if (layout.orientation === 'portrait') landscape = false
  else {
    const pref = preferredWidths(items, cols, font, bold, tableSize)
    landscape = pref.reduce((a, b) => a + b, 0) > portraitAvail * AUTO_LANDSCAPE_FACTOR
  }
  const pageWidth = landscape ? A4_LONG : A4_SHORT
  const pageHeight = landscape ? A4_SHORT : A4_LONG
  const contentWidth = pageWidth - 2 * margin

  const colWidths = fitWidths(preferredWidths(items, cols, font, bold, tableSize), cols, contentWidth)

  let page!: PDFPage
  let y = 0
  function newPage() {
    page = doc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }
  newPage()

  // ---- Kop (alleen eerste pagina) ----
  function drawHeader() {
    const topY = y
    let logoBottom = topY
    if (logo) {
      const baseH = 46 * Math.max(0.3, Math.min(2.5, layout.logoScale))
      const dims = logo.scale(baseH / logo.height)
      let x = margin
      if (layout.logoAlign === 'center') x = (pageWidth - dims.width) / 2
      else if (layout.logoAlign === 'right') x = pageWidth - margin - dims.width
      x += layout.logoOffsetX
      x = Math.max(margin, Math.min(x, pageWidth - margin - dims.width))
      const logoTop = topY - Math.max(0, layout.logoOffsetY) // omlaag nudgen
      page.drawImage(logo, { x, y: logoTop - dims.height, width: dims.width, height: dims.height })
      logoBottom = logoTop - dims.height
    }

    // Twee blokken naast elkaar bovenaan: bedrijfsgegevens aan de gekozen kant
    // (companyInfo), certificaatgegevens aan de andere kant. Beide starten
    // standaard bovenaan de pagina (flankeren een gecentreerd logo) en zijn
    // verticaal te nudgen via headerOffsetY (wens Jos 2026-06-26).
    const startY = topY - Math.max(0, layout.headerOffsetY)
    const c = data.company

    // Bedrijfsgegevens-regels.
    const companyLines: { text: string; size: number; font: PDFFont; color: Color }[] = []
    companyLines.push({ text: c.name, size: 15, font: bold, color: accent })
    if (layout.showAddress && (c.address || c.postal_code || c.city || c.province)) {
      companyLines.push({
        text: [c.address, [[c.postal_code, c.city].filter(Boolean).join(' '), c.province].filter(Boolean).join(', ')]
          .filter(Boolean)
          .join(', '),
        size: 9,
        font,
        color: grey,
      })
    }
    if (layout.showContact && (c.email || c.phone)) {
      companyLines.push({ text: [c.email, c.phone].filter(Boolean).join('  ·  '), size: 9, font, color: grey })
    }
    if (layout.showRegistration && (c.registration_number || c.vat_number)) {
      companyLines.push({
        text: [c.registration_number ? `KvK ${c.registration_number}` : null, c.vat_number ? `BTW ${c.vat_number}` : null]
          .filter(Boolean)
          .join('  ·  '),
        size: 9,
        font,
        color: grey,
      })
    }

    const rightEdge = pageWidth - margin
    const companyOnRight = layout.companyInfo === 'right'
    // Beide blokken hugmen hun eigen buitenkant: het blok rechts wordt rechts
    // uitgelijnd tegen de rechtermarge, het blok links tegen de linkermarge.
    const certOnRight = !companyOnRight
    const lineX = (w: number, onRight: boolean) => (onRight ? rightEdge - w : margin)

    // Bedrijfsgegevens tekenen.
    let compY = startY
    for (const l of companyLines) {
      const w = l.font.widthOfTextAtSize(l.text, l.size)
      page.drawText(l.text, { x: lineX(w, companyOnRight), y: compY - l.size, size: l.size, font: l.font, color: l.color })
      compY -= l.size + 4
    }

    // Certificaatgegevens tekenen (rechts uitgelijnd als ze aan de rechterkant staan).
    let certY = startY
    const titleW = bold.widthOfTextAtSize('Keuringscertificaat', 13)
    page.drawText('Keuringscertificaat', { x: lineX(titleW, certOnRight), y: certY - 13, size: 13, font: bold, color: accent })
    certY -= 13 + 8
    const meta = [
      `Certificaatnummer: ${data.number}`,
      `Klant: ${data.customerName}`,
      `Keuringsdatum: ${formatDate(data.inspectionDate)}`,
      `Keurmeester: ${data.inspectorName || '—'}`,
    ]
    for (const m of meta) {
      const w = font.widthOfTextAtSize(m, 10)
      page.drawText(m, { x: lineX(w, certOnRight), y: certY - 10, size: 10, font, color: rgb(0, 0, 0) })
      certY -= 10 + 3
    }

    // Onder de laagste van de drie koptekst-elementen (logo + beide kolommen).
    let cy = Math.min(compY, certY, logoBottom) - 12

    // Intro-/koptekst (juridische standaardtekst van het keurbedrijf), volle breedte.
    if (c.cert_header) {
      for (const ln of wrapText(c.cert_header, font, 8.5, contentWidth)) {
        page.drawText(ln, { x: margin, y: cy - 8.5, size: 8.5, font, color: grey })
        cy -= 8.5 + 2.5
      }
    }
    y = cy - 10
  }
  drawHeader()

  // ---- Tabel ----
  function drawTableHeader() {
    const h = tableSize + 10
    page.drawRectangle({ x: margin, y: y - h, width: contentWidth, height: h, color: tint(accent, 0.86) })
    let x = margin
    cols.forEach((col, i) => {
      page.drawText(col.header, { x: x + CELL_PAD, y: y - tableSize - 4, size: tableSize, font: bold, color: accent })
      x += colWidths[i]
    })
    y -= h
  }
  drawTableHeader()

  const lineGap = tableSize + 3
  for (const it of items) {
    // Cel-regels vooraf berekenen om de rijhoogte te kennen.
    const cellLines = cols.map((col, i) =>
      wrapText(cellText(col, it), font, tableSize, colWidths[i] - CELL_PAD * 2)
    )
    const maxLines = Math.max(...cellLines.map((l) => l.length))
    const rowHeight = maxLines * lineGap + 6

    if (y - rowHeight < margin + 8) {
      newPage()
      drawTableHeader()
    }

    const passed = it.result === 'passed'
    let x = margin
    cols.forEach((col, i) => {
      const isStatus = col.key === 'status'
      const cellFont = isStatus ? bold : font
      const cellColor = isStatus ? (passed ? rgb(0.09, 0.5, 0.25) : rgb(0.75, 0.1, 0.1)) : rgb(0.1, 0.1, 0.1)
      cellLines[i].forEach((ln, li) => {
        page.drawText(ln, {
          x: x + CELL_PAD,
          y: y - tableSize - 4 - li * lineGap,
          size: tableSize,
          font: cellFont,
          color: cellColor,
        })
      })
      x += colWidths[i]
    })
    y -= rowHeight
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lineGrey })
  }

  // ---- Voetblok (bij elkaar gehouden, onderaan de laatste pagina vastgepind) ----
  const footerText = data.company.cert_footer || ''
  const footerLines = footerText ? wrapText(footerText, font, 8, contentWidth) : []
  // QR-grootte = breedte van de groene "geverifieerd"-regel, zodat QR en tekst
  // eronder netjes uitlijnen (wens Jos 2026-06-26). Begrensd voor een redelijk
  // formaat.
  const verifyCaption = 'geverifieerd met gearonimo'
  const qrSize = Math.max(82, Math.min(118, Math.round(bold.widthOfTextAtSize(verifyCaption, 6.5))))
  const sigBlockHeight = 30 + footerLines.length * 11 + qrSize + 18
  if (y - sigBlockHeight < margin) {
    newPage()
  }

  // Vastpinnen onderaan: teken vanaf de ondermarge omhoog.
  let fy = margin
  // QR rechtsonder + verificatie-tekst, met het Gearonimo-merk ernaast.
  const qrX = pageWidth - margin - qrSize
  page.drawImage(qrImage, { x: qrX, y: fy, width: qrSize, height: qrSize })
  const gearGreen = rgb(0.086, 0.639, 0.29) // #16a34a
  // Branded QR: mini Gearonimo-merk in de kern, op een wit quiet-zone-blokje.
  // De QR staat op error-correctie 'H' (~30% herstel); de afdekking is ~9% van
  // het oppervlak, ruim binnen de tolerantie, dus de code blijft scanbaar.
  if (gearMark) {
    const box = qrSize * 0.3
    const bcx = qrX + qrSize / 2
    const bcy = fy + qrSize / 2
    page.drawRectangle({ x: bcx - box / 2, y: bcy - box / 2, width: box, height: box, color: rgb(1, 1, 1) })
    const mh = box * 0.86
    const mw = (gearMark.width / gearMark.height) * mh
    page.drawImage(gearMark, { x: bcx - mw / 2, y: bcy - mh / 2, width: mw, height: mh })
  }
  page.drawText('Scan om te verifiëren', { x: qrX, y: fy - 9, size: 7, font, color: grey })
  page.drawText(verifyCaption, { x: qrX, y: fy - 18, size: 6.5, font: bold, color: gearGreen })
  // Handtekeningvlak links.
  page.drawText(`Keurmeester: ${data.inspectorName || '—'}`, { x: margin, y: fy + 12, size: 9, font, color: rgb(0, 0, 0) })
  page.drawLine({ start: { x: margin, y: fy + 30 }, end: { x: margin + 200, y: fy + 30 }, thickness: 0.6, color: rgb(0.6, 0.6, 0.6) })
  page.drawText('Handtekening', { x: margin, y: fy, size: 7, font, color: grey })

  fy += qrSize + 14
  if (footerLines.length) {
    for (let i = footerLines.length - 1; i >= 0; i--) {
      page.drawText(footerLines[i], { x: margin, y: fy, size: 8, font, color: grey })
      fy += 11
    }
  }
  page.drawText(`Uitgegeven: ${formatDate(new Date())}`, { x: margin, y: fy + 2, size: 8, font, color: grey })

  // ---- Paginanummers op elke pagina ----
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    const label = `Pagina ${i + 1} van ${pages.length}`
    const w = font.widthOfTextAtSize(label, 8)
    p.drawText(label, { x: (pageWidth - w) / 2, y: 22, size: 8, font, color: grey })
  })

  return doc.save()
}

// ----------------------------------------------------------------------------
// Logo ophalen uit Storage
// ----------------------------------------------------------------------------

export async function fetchLogoBytes(logoPath: string | null): Promise<Uint8Array | null> {
  if (!logoPath) return null
  const { data, error } = await supabase.storage.from('branding').download(logoPath)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

// ----------------------------------------------------------------------------
// Echte certificaatgeneratie bij het afronden van een keuring
// ----------------------------------------------------------------------------

interface CompanyRow extends CertCompany {
  country_code: string
  logo_path: string | null
  cert_layout: unknown
}

export async function generateCertificate(inspectionId: string): Promise<{ verifyToken: string; storagePath: string }> {
  const { data: insp, error: insErr } = await supabase
    .from('inspections')
    .select(
      'id, customer_id, company_id, inspector_id, inspection_date, customer:customers(name), company:inspection_companies(name, country_code, address, postal_code, city, province, email, phone, registration_number, vat_number, cert_header, cert_footer, logo_path, cert_layout), inspector:inspectors(name)'
    )
    .eq('id', inspectionId)
    .single()
  if (insErr) throw insErr
  const inspection = insp as unknown as {
    id: string
    customer_id: string
    company_id: string
    inspection_date: string
    customer: { name: string }
    company: CompanyRow
    inspector: { name: string | null }
  }

  const { data: rows, error: itemsErr } = await supabase
    .from('inspection_items')
    .select(
      'result, next_due, comment, article:articles(serial_number, free_brand, free_description, free_category, free_norm, free_mbs, manufacture_year, manufacture_month, assigned_user_name, product:products(brand, name, category, standard, breaking_strength)), rejection_code:rejection_codes(label)'
    )
    .eq('inspection_id', inspectionId)
    .order('created_at')
  if (itemsErr) throw itemsErr

  // Niet-beoordeelde artikelen (vergeten/kwijt op de keurdag) horen niet op
  // het certificaat — ze blijven wel bij de klant staan voor een volgende keer.
  const items: CertItem[] = (rows ?? []).filter((r: any) => r.result !== 'not_assessed').map((r: any) => {
    const a = r.article
    const p = a?.product
    return {
      result: r.result,
      brand: (p ? p.brand : a?.free_brand) ?? null,
      name: (p ? p.name : a?.free_description) ?? null,
      serial_number: a?.serial_number ?? null,
      manufacture_year: a?.manufacture_year ?? null,
      manufacture_month: a?.manufacture_month ?? null,
      category: (p ? p.category : a?.free_category) ?? null,
      norm: (p ? p.standard : a?.free_norm) ?? null,
      mbs: (p ? p.breaking_strength : a?.free_mbs) ?? null,
      user: a?.assigned_user_name ?? null,
      next_due: r.next_due,
      rejection_code_label: r.rejection_code?.label ?? null,
      comment: r.comment,
    }
  })

  const verifyToken = crypto.randomUUID()
  const number = `${inspection.inspection_date.replace(/-/g, '')}-${slugify(inspection.customer.name)}`
  const verifyUrl = `${window.location.origin}/verify/${verifyToken}`

  const company = inspection.company
  const layout = resolveLayout(company.cert_layout)
  const logoBytes = await fetchLogoBytes(company.logo_path)

  const data: CertData = {
    company,
    customerName: inspection.customer.name,
    inspectionDate: inspection.inspection_date,
    inspectorName: inspection.inspector?.name ?? null,
    number,
    verifyUrl,
    items,
  }

  const pdfBytes = await renderCertificatePdf(data, layout, logoBytes)
  const pdfHash = await sha256Hex(pdfBytes)

  const storagePath = `${inspection.company_id}/${inspection.id}.pdf`
  const { error: uploadErr } = await supabase.storage
    .from('certificates')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false })
  if (uploadErr) throw uploadErr

  const { error: certErr } = await supabase.from('certificates').insert({
    inspection_id: inspection.id,
    number,
    storage_path: storagePath,
    language: company.country_code === 'GB' ? 'en' : 'nl',
    pdf_hash: pdfHash,
    verify_token: verifyToken,
  })
  if (certErr) throw certErr

  await supabase.from('inspections').update({ certificate_number: number }).eq('id', inspection.id)

  return { verifyToken, storagePath }
}
