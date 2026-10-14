// Her notes, from a file: .txt and .md are read as they are, a Word file is
// unzipped and its text pulled out (no library needed), and a PDF or a photo of
// handwritten notes is attached as-is for the buddy to read. Everything happens
// on her device; only what she sends to the buddy leaves it.
import { MAX_NOTES, type Attachment } from './buddy.ts'

export type ImportProblem = 'unsupported' | 'too-big' | 'too-many-pages' | 'unreadable'

export class ImportError extends Error {
  readonly problem: ImportProblem
  constructor(problem: ImportProblem, message: string = problem) {
    super(message)
    this.problem = problem
  }
}

export function importProblem(e: unknown, name: string): string {
  const p = e instanceof ImportError ? e.problem : 'unreadable'
  if (p === 'unsupported') return `${name}: not a file type the buddy can read yet. try txt, docx, pdf, or a photo (export Pages or Google Docs as Word or PDF).`
  if (p === 'too-big') return `${name} is too big. the buddy reads files up to ${MAX_FILE_MB} MB; try a chapter at a time.`
  if (p === 'too-many-pages') return `${name} is a long one. the buddy reads up to ${MAX_PDF_PAGES} pages at a time; try a chapter.`
  return `couldn’t read ${name}. is it a normal, unlocked file?`
}

export const MAX_FILE_MB = 7
export const MAX_PDF_PAGES = 40
export const MAX_FILES = 6
/** Photos are shrunk to this many pixels on the long side (plenty for reading, cheap to send). */
const MAX_IMAGE_PX = 1600

export type Imported = { kind: 'text'; text: string } | { kind: 'file'; attachment: Attachment; pages?: number }

export type FileKind = 'text' | 'docx' | 'pdf' | 'image' | 'unsupported'

/** What kind of file this is, from its name first (Safari sometimes leaves the type blank). */
export function fileKind(name: string, type = ''): FileKind {
  const ext = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? ''
  if (['txt', 'md', 'markdown', 'text'].includes(ext) || (!ext && type.startsWith('text/'))) return 'text'
  if (ext === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (ext === 'pdf' || type === 'application/pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext) || type.startsWith('image/')) return 'image'
  return 'unsupported'
}

export async function importNotesFile(file: File): Promise<Imported> {
  const kind = fileKind(file.name, file.type)
  if (kind === 'unsupported') throw new ImportError('unsupported')
  if (file.size > MAX_FILE_MB * 1024 * 1024 && kind !== 'image') throw new ImportError('too-big')
  if (kind === 'text') return { kind: 'text', text: (await file.text()).replace(/\r\n?/g, '\n') }
  if (kind === 'docx') {
    const xml = await unzipEntry(await file.arrayBuffer(), 'word/document.xml')
    if (!xml) throw new ImportError('unreadable')
    return { kind: 'text', text: docxXmlToText(new TextDecoder().decode(xml)) }
  }
  if (kind === 'pdf') {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.length < 8 || new TextDecoder('latin1').decode(bytes.subarray(0, 5)) !== '%PDF-') throw new ImportError('unreadable')
    const pages = pdfPageCount(bytes)
    if (pages > MAX_PDF_PAGES) throw new ImportError('too-many-pages')
    return { kind: 'file', attachment: { kind: 'pdf', media: 'application/pdf', data: base64(bytes), name: file.name }, pages }
  }
  return { kind: 'file', attachment: await imageToJpeg(file) }
}

/** Roughly how many pages a PDF has (counts its page objects). */
export function pdfPageCount(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes)
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length
}

function base64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** A photo of her notes, shrunk and re-encoded as JPEG (HEIC from an iPhone included: the browser decodes it). */
async function imageToJpeg(file: File): Promise<Attachment> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, MAX_IMAGE_PX / Math.max(img.naturalWidth, img.naturalHeight, 1))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * scale))
    c.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = c.getContext('2d')
    if (!ctx) throw new ImportError('unreadable')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const data = c.toDataURL('image/jpeg', 0.85).split(',')[1]
    if (!data) throw new ImportError('unreadable')
    return { kind: 'image', media: 'image/jpeg', data, name: file.name }
  } catch (e) {
    throw e instanceof ImportError ? e : new ImportError('unreadable')
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ─── a very small zip reader (a .docx is a zip with word/document.xml inside) ──

const SIG_EOCD = 0x06054b50
const SIG_CEN = 0x02014b50
const SIG_LOC = 0x04034b50

/** One file out of a zip, inflated if need be. Null if it isn't there (or this isn't a zip). */
export async function unzipEntry(buf: ArrayBuffer, wanted: string): Promise<Uint8Array | null> {
  const b = new Uint8Array(buf)
  const dv = new DataView(buf)
  if (b.length < 22) return null
  let eocd = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const count = dv.getUint16(eocd + 10, true)
  let off = dv.getUint32(eocd + 16, true)
  const names = new TextDecoder()
  for (let n = 0; n < count && off + 46 <= b.length; n++) {
    if (dv.getUint32(off, true) !== SIG_CEN) return null
    const method = dv.getUint16(off + 10, true)
    const csize = dv.getUint32(off + 20, true)
    const nameLen = dv.getUint16(off + 28, true)
    const extraLen = dv.getUint16(off + 30, true)
    const commentLen = dv.getUint16(off + 32, true)
    const local = dv.getUint32(off + 42, true)
    const name = names.decode(b.subarray(off + 46, off + 46 + nameLen))
    off += 46 + nameLen + extraLen + commentLen
    if (name !== wanted) continue
    if (local + 30 > b.length || dv.getUint32(local, true) !== SIG_LOC) return null
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true)
    const data = b.slice(start, start + csize)
    if (method === 0) return data
    if (method !== 8) return null
    const inflated = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')))
    return new Uint8Array(await inflated.arrayBuffer())
  }
  return null
}

/** The words out of Word's XML: paragraphs become lines, tabs stay tabs. */
export function docxXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>|<w:cr\/>/g, '\n')
    .replace(/<\/w:p>|<w:p\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Add imported text to what she already typed, within the buddy's limit. Returns the text and whether it was cut. */
export function appendNotes(existing: string, more: string): { text: string; cut: boolean } {
  const joined = existing.trim() ? `${existing.trimEnd()}\n\n${more.trim()}` : more.trim()
  return { text: joined.slice(0, MAX_NOTES), cut: joined.length > MAX_NOTES }
}
