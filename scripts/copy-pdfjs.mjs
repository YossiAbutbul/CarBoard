// Copies the files pdf.js loads at run time (character maps for non-Latin text, the standard
// fonts, and its image decoders) into public/pdfjs, so PDFs in Hebrew draw correctly.
// Runs before `dev` and `build`; the copy is git-ignored.
import { cpSync, rmSync } from 'node:fs'

const from = new URL('../node_modules/pdfjs-dist/', import.meta.url)
const to = new URL('../public/pdfjs/', import.meta.url)
rmSync(to, { recursive: true, force: true })
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) cpSync(new URL(dir, from), new URL(dir, to), { recursive: true })
