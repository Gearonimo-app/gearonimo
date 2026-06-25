import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { supabase } from '@gearonimo/core'

// Genereert het certificaat-PDF bij het afronden van een keuring
// (DATAMODEL §certificates, bouwplan fase 2: "Certificaat-PDF server-side"
// — hier client-side gebouwd, want er is nog geen edge-function-infra; de
// PDF wordt eenmalig vastgelegd en daarna nooit herschreven, dus waar hij
// gebouwd wordt maakt voor de juridische waarde niet uit).
//
// Verwacht een afgeronde (status='completed') inspectie; slaat de PDF op in
// Storage-bucket "certificates", berekent een hash en maakt het
// certificates-record met een verify_token voor de QR-verificatiepagina.

interface InspectionForCertificate {
  id: string
  customer_id: string
  company_id: string
  inspector_id: string
  inspection_date: string
  customer: { name: string }
  company: {
    name: string
    country_code: string
    address: string | null
    postal_code: string | null
    city: string | null
    email: string | null
    phone: string | null
    cert_header: string | null
    cert_footer: string | null
  }
  inspector: { name: string | null }
}

interface ItemForCertificate {
  result: string
  next_due: string | null
  comment: string | null
  rejection_code_label: string | null
  article: {
    serial_number: string | null
    free_brand: string | null
    free_description: string | null
    product: { brand: string | null; name: string | null; product_type: string | null } | null
  }
}

function itemLabel(it: ItemForCertificate): string {
  const a = it.article
  const s = a.product
    ? [a.product.brand, a.product.name].filter(Boolean).join(' ')
    : [a.free_brand, a.free_description].filter(Boolean).join(' ')
  return s || '—'
}

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
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

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateCertificate(inspectionId: string): Promise<{ verifyToken: string; storagePath: string }> {
  const { data: insp, error: insErr } = await supabase
    .from('inspections')
    .select(
      'id, customer_id, company_id, inspector_id, inspection_date, customer:customers(name), company:inspection_companies(name, country_code, address, postal_code, city, email, phone, cert_header, cert_footer), inspector:inspectors(name)'
    )
    .eq('id', inspectionId)
    .single()
  if (insErr) throw insErr
  const inspection = insp as unknown as InspectionForCertificate

  const { data: rows, error: itemsErr } = await supabase
    .from('inspection_items')
    .select(
      'result, next_due, comment, article:articles(serial_number, free_brand, free_description, product:products(brand, name, product_type)), rejection_code:rejection_codes(label)'
    )
    .eq('inspection_id', inspectionId)
    .order('created_at')
  if (itemsErr) throw itemsErr
  const items = (rows ?? []).map((r: any) => ({
    ...r,
    rejection_code_label: r.rejection_code?.label ?? null,
  })) as ItemForCertificate[]

  const verifyToken = crypto.randomUUID()
  const number = `${inspection.inspection_date.replace(/-/g, '')}-${slugify(inspection.customer.name)}`
  const verifyUrl = `${window.location.origin}/verify/${verifyToken}`

  const pdfBytes = await buildPdf(inspection, items, number, verifyUrl)
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
    language: inspection.company.country_code === 'GB' ? 'en' : 'nl',
    pdf_hash: pdfHash,
    verify_token: verifyToken,
  })
  if (certErr) throw certErr

  await supabase.from('inspections').update({ certificate_number: number }).eq('id', inspection.id)

  return { verifyToken, storagePath }
}

async function buildPdf(
  inspection: InspectionForCertificate,
  items: ItemForCertificate[],
  number: string,
  verifyUrl: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 200 })
  const qrImage = await doc.embedPng(qrDataUrl)

  const margin = 50
  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function ensureSpace(needed: number) {
    if (y - needed < margin + 80) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  function line(text: string, opts: { size?: number; bold?: boolean; gap?: number; color?: ReturnType<typeof rgb> } = {}) {
    const size = opts.size ?? 11
    ensureSpace(size + (opts.gap ?? 4))
    page.drawText(text, { x: margin, y, size, font: opts.bold ? bold : font, color: opts.color ?? rgb(0, 0, 0) })
    y -= size + (opts.gap ?? 4)
  }

  const company = inspection.company
  const headerText = company.cert_header || `${company.name} — Keuringscertificaat`
  line(headerText, { size: 16, bold: true, gap: 10 })
  if (company.address || company.postal_code || company.city) {
    line([company.address, [company.postal_code, company.city].filter(Boolean).join(' ')].filter(Boolean).join(', '), {
      size: 9,
      color: rgb(0.35, 0.35, 0.35),
    })
  }
  if (company.email || company.phone) {
    line([company.email, company.phone].filter(Boolean).join('  ·  '), { size: 9, color: rgb(0.35, 0.35, 0.35), gap: 14 })
  }

  line(`Certificaatnummer: ${number}`, { size: 11, gap: 2 })
  line(`Klant: ${inspection.customer.name}`, { size: 11, gap: 2 })
  line(`Keuringsdatum: ${formatDate(inspection.inspection_date)}`, { size: 11, gap: 2 })
  line(`Keurmeester: ${inspection.inspector?.name ?? '—'}`, { size: 11, gap: 16 })

  line('Gekeurde artikelen', { size: 13, bold: true, gap: 8 })

  for (const it of items) {
    ensureSpace(40)
    const passed = it.result === 'passed'
    line(`${passed ? 'GOED' : 'AFGEKEURD'} — ${itemLabel(it)}`, {
      size: 11,
      bold: true,
      color: passed ? rgb(0.09, 0.5, 0.25) : rgb(0.75, 0.1, 0.1),
      gap: 2,
    })
    const article = it.article
    if (article.serial_number) line(`SN ${article.serial_number}`, { size: 9, color: rgb(0.35, 0.35, 0.35), gap: 2 })
    if (it.next_due) line(`Volgende keuring uiterlijk: ${formatDate(it.next_due)}`, { size: 9, gap: 2 })
    if (!passed) {
      if (it.rejection_code_label) line(`Afkeurcode: ${it.rejection_code_label}`, { size: 9, gap: 2 })
      if (it.comment) line(`Opmerking: ${it.comment}`, { size: 9, gap: 2 })
    }
    y -= 4
  }

  // Voettekst met handtekeningvlak en verificatie-QR onderaan de laatste pagina.
  ensureSpace(140)
  y -= 10
  line(company.cert_footer || 'Dit certificaat is een momentopname op de genoemde keuringsdatum en geen garantie tot een datum.', {
    size: 8,
    color: rgb(0.45, 0.45, 0.45),
    gap: 6,
  })
  line(`Uitgegeven: ${formatDate(new Date())}`, { size: 8, color: rgb(0.45, 0.45, 0.45), gap: 6 })

  const qrSize = 70
  page.drawImage(qrImage, { x: pageWidth - margin - qrSize, y: margin, width: qrSize, height: qrSize })
  page.drawText('Scan om te verifiëren', { x: pageWidth - margin - qrSize, y: margin - 12, size: 7, font, color: rgb(0.45, 0.45, 0.45) })

  return doc.save()
}
