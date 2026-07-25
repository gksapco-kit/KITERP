/**
 * Extract plain text from .doc / .docx for in-app career CV preview.
 * Usage: node extract_word_text.js <absolute-file-path>
 */
const fs = require('fs')
const path = require('path')

function resolveWordExtractor() {
  const candidates = [
    path.resolve(__dirname, 'node_modules/word-extractor'),
    path.resolve(__dirname, '../../frontend/node_modules/word-extractor'),
    'word-extractor',
  ]
  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch {
      /* try next */
    }
  }
  throw new Error('word-extractor package not found')
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath || !fs.existsSync(filePath)) {
    process.stderr.write('Usage: node extract_word_text.js <file>\n')
    process.exit(2)
  }
  const WordExtractor = resolveWordExtractor()
  const extractor = new WordExtractor()
  const doc = await extractor.extract(filePath)
  const body = (doc.getBody && doc.getBody()) || ''
  const headers = (doc.getHeaders && doc.getHeaders()) || ''
  const footnotes = (doc.getFootnotes && doc.getFootnotes()) || ''
  process.stdout.write(JSON.stringify({ body, headers, footnotes }))
}

main().catch((err) => {
  process.stderr.write(String((err && err.stack) || err) + '\n')
  process.exit(1)
})
