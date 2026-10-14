import { describe, expect, it } from 'vitest'
import { appendNotes, docxXmlToText, fileKind, pdfPageCount, unzipEntry } from './notesImport.ts'
import { MAX_NOTES } from './buddy.ts'

const enc = new TextEncoder()

/** A zip with one file, stored or deflated, the way Word writes them. */
async function zip(name: string, content: string, deflate: boolean): Promise<ArrayBuffer> {
  const raw = enc.encode(content)
  const data = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw
  const nameB = enc.encode(name)
  const local = new Uint8Array(30)
  const ldv = new DataView(local.buffer)
  ldv.setUint32(0, 0x04034b50, true)
  ldv.setUint16(8, deflate ? 8 : 0, true)
  ldv.setUint32(18, data.length, true)
  ldv.setUint32(22, raw.length, true)
  ldv.setUint16(26, nameB.length, true)
  const cen = new Uint8Array(46)
  const cdv = new DataView(cen.buffer)
  cdv.setUint32(0, 0x02014b50, true)
  cdv.setUint16(10, deflate ? 8 : 0, true)
  cdv.setUint32(20, data.length, true)
  cdv.setUint32(24, raw.length, true)
  cdv.setUint16(28, nameB.length, true)
  cdv.setUint32(42, 0, true)
  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true)
  edv.setUint16(8, 1, true)
  edv.setUint16(10, 1, true)
  edv.setUint32(12, 46 + nameB.length, true)
  edv.setUint32(16, 30 + nameB.length + data.length, true)
  const parts = [local, nameB, data, cen, nameB, eocd]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out.buffer
}

const DOC =
  '<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Negligence</w:t></w:r><w:r><w:t xml:space="preserve"> has four elements</w:t></w:r></w:p><w:p><w:r><w:t>duty</w:t><w:tab/><w:t>a legal obligation &amp; a standard of care</w:t></w:r></w:p><w:p/><w:p><w:r><w:t>Palsgraf v. Long Island R.R. &#8212; foreseeability</w:t></w:r></w:p></w:body></w:document>'

describe('reading her notes from a file', () => {
  it('knows the file types, by name before type', () => {
    expect(fileKind('outline.docx')).toBe('docx')
    expect(fileKind('Notes.TXT', '')).toBe('text')
    expect(fileKind('brief.pdf', 'application/pdf')).toBe('pdf')
    expect(fileKind('IMG_2041.HEIC', '')).toBe('image')
    expect(fileKind('photo', 'image/jpeg')).toBe('image')
    expect(fileKind('deck.pages')).toBe('unsupported')
  })

  it('pulls the text out of a Word file, stored or deflated', async () => {
    for (const deflate of [false, true]) {
      const xml = await unzipEntry(await zip('word/document.xml', DOC, deflate), 'word/document.xml')
      expect(xml).not.toBeNull()
      expect(docxXmlToText(new TextDecoder().decode(xml!))).toBe('Negligence has four elements\nduty\ta legal obligation & a standard of care\n\nPalsgraf v. Long Island R.R. — foreseeability')
    }
    expect(await unzipEntry(await zip('other.xml', DOC, false), 'word/document.xml')).toBeNull()
    expect(await unzipEntry(enc.encode('%PDF-1.4 not a zip at all, honestly').buffer as ArrayBuffer, 'word/document.xml')).toBeNull()
  })

  it('counts a PDF’s pages, roughly', () => {
    const pdf =
      '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R >> endobj\n4 0 obj << /Type /Page /Parent 2 0 R >> endobj\n%%EOF'
    expect(pdfPageCount(enc.encode(pdf))).toBe(2)
  })

  it('adds imported text under what she typed, within the limit', () => {
    expect(appendNotes('', 'hello')).toEqual({ text: 'hello', cut: false })
    expect(appendNotes('typed ', 'imported')).toEqual({ text: 'typed\n\nimported', cut: false })
    const long = appendNotes('a', 'b'.repeat(MAX_NOTES))
    expect(long.text).toHaveLength(MAX_NOTES)
    expect(long.cut).toBe(true)
  })
})
