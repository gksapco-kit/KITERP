import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/integration-logos')
fs.mkdirSync(outDir, { recursive: true })

const WORDMARK_SVG = {
  sendgrid: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 40"><text x="0" y="28" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="26" font-weight="700">SendGrid</text></svg>`,
  smtp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40"><text x="0" y="28" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="26" font-weight="700">SMTP</text></svg>`,
  twilio: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40"><text x="0" y="29" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="28" font-weight="700">twilio</text></svg>`,
  meta_whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 40"><text x="0" y="28" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="24" font-weight="600">WhatsApp</text></svg>`,
  openai: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40"><text x="0" y="28" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="24" font-weight="600">OpenAI</text></svg>`,
  google_calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 40"><text x="0" y="28" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="22" font-weight="600">Google Calendar</text></svg>`,
  outlook_calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 40"><text x="0" y="28" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="22" font-weight="600">Outlook Calendar</text></svg>`,
  stripe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40"><text x="0" y="29" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="28" font-weight="700">stripe</text></svg>`,
  square: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40"><text x="0" y="28" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="26" font-weight="600">Square</text></svg>`,
  paypal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40"><text x="0" y="28" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="26" font-weight="700"><tspan>Pay</tspan><tspan fill="#009CDE">Pal</tspan></text></svg>`,
  payu: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><text x="0" y="29" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="28" font-weight="800"><tspan>Pay</tspan><tspan fill="#A6CE39">U</tspan></text></svg>`,
}

async function fetchSvg(slug) {
  const urls = [
    `https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/${slug}.svg`,
    `https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/${slug}.svg`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const text = await res.text()
      if (text.includes('<svg')) return text
    } catch {
      // try next
    }
  }
  return null
}

async function svgToPng(svg, outFile, width = 220, height = 40) {
  const png = await sharp(Buffer.from(svg))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  fs.writeFileSync(outFile, png)
}

async function main() {
  const officialRazorpay = path.join(__dirname, '../public/payment-logos/razorpay.png')
  if (fs.existsSync(officialRazorpay)) {
    fs.copyFileSync(officialRazorpay, path.join(outDir, 'razorpay.png'))
    console.log('OK razorpay (official PNG)')
  }

  for (const [id, svg] of Object.entries(WORDMARK_SVG)) {
    const outFile = path.join(outDir, `${id}.png`)
    await svgToPng(svg, outFile)
    console.log(`OK ${id}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
