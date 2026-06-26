const ACCENT = '#1a56db'

export interface OfferShellCtx {
  content: string
  vendor: string
  candidate: string
  ref: string
  today: string
  embed: boolean
  logo?: { url?: string; show?: boolean; shape?: string }
  mark: (size?: number) => string
}

const ALIASES: Record<string, string> = {
  standard: 'classic',
  two_column: 'colorblock',
  toprightbottomleft: 'toprightlogobottomleft',
  topleftbottomright: 'topleftlogobottomright',
  topbottom: 'toprightlogobottomleft',
  dual: 'leftlogo',
}

export function normalizeOfferLayoutId(id: string): string {
  const key = (id || 'classic').trim().toLowerCase()
  return ALIASES[key] ?? key
}

function pads(embed: boolean) {
  return {
    padLg: embed ? '24px 32px' : '48px 56px',
    padMd: embed ? '24px 32px' : '40px 48px',
    padSm: embed ? '24px 32px' : '32px 56px 48px',
    szLg: embed ? 52 : 64,
    szMd: embed ? 48 : 56,
    szSm: embed ? 40 : 48,
  }
}

function signatureRow(): string {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:36px;padding:0 32px 8px">
    <div><div style="border-top:1px solid #374151;margin-top:52px;padding-top:8px;font-size:11px;color:#4b5563">Company Representative (Sign)</div></div>
    <div><div style="border-top:1px solid #374151;margin-top:52px;padding-top:8px;font-size:11px;color:#4b5563">Candidate (Sign)</div></div>
  </div>`
}

function markAt(ctx: OfferShellCtx, size: number): string {
  if (!ctx.logo?.show) return ''
  return ctx.mark(size)
}

function markBlock(ctx: OfferShellCtx, size: number, wrapStyle = ''): string {
  const html = markAt(ctx, size)
  if (!html) return ''
  return wrapStyle ? `<div style="${wrapStyle}">${html}</div>` : html
}

function refLine(ref: string): string {
  return ref ? `<span style="color:#b91c1c;font-weight:600">Ref: ${ref}</span>` : ''
}

function refDiv(ref: string, extra = ''): string {
  return ref ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px${extra ? `;${extra}` : ''}">Ref: ${ref}</div>` : ''
}

function bodyWrap(content: string, pad?: string): string {
  const outer = pad ? `<div style="padding:${pad}">` : ''
  const close = pad ? '</div>' : ''
  return `${outer}<div class="body-content">${content}</div>${close}`
}

function footerMarkRow(ctx: OfferShellCtx, size: number, side: 'left' | 'right'): string {
  const html = markAt(ctx, size)
  if (!html) return ''
  const justify = side === 'left' ? 'flex-start' : 'flex-end'
  return `<div style="padding:12px 32px 20px;display:flex;justify-content:${justify};border-top:1px solid #e5e7eb;margin-top:4px">${html}</div>`
}

type PadVals = ReturnType<typeof pads>
type ShellFn = (ctx: OfferShellCtx, p: PadVals) => string

function shellClassic(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const mark = markBlock(ctx, p.szMd)
  const left = mark
    ? `<div style="display:flex;align-items:center;gap:14px;min-width:0;flex:1"><div>${mark}</div><div style="min-width:0"><div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:700;color:${ACCENT}">${vendor}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div></div></div>`
    : `<div style="min-width:0;flex:1"><div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:700;color:${ACCENT}">${vendor}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div></div>`
  return `<div class="page-inner"><div style="padding:${p.padLg};padding-bottom:${ctx.embed ? '18px' : '32px'};border-bottom:3px solid ${ACCENT};display:flex;justify-content:space-between;align-items:center;gap:16px">${left}
    <div style="text-align:right"><div style="font-size:${ctx.embed ? '14px' : '18px'};font-weight:600;color:#374151">Offer Letter</div>${refDiv(ref)}<div style="font-size:11px;color:#6b7280;margin-top:6px">${today}</div></div></div>
    <div style="padding:8px 32px 0;font-size:12px"><strong>Candidate:</strong> ${candidate}</div>
    ${bodyWrap(content, p.padSm)}</div>`
}

function shellModern(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, content } = ctx
  const markHtml = markBlock(ctx, p.szMd, 'margin-bottom:10px')
  const refHtml = ref ? `<div style="font-size:10px;opacity:.85;margin-top:8px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner"><div style="background:linear-gradient(135deg,${ACCENT},#4f46e5);color:#fff;padding:${p.padMd}">${markHtml}
    <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.85">Offer Letter</div>
    <div style="font-size:${ctx.embed ? '20px' : '24px'};font-weight:800;margin-top:4px">${vendor}</div>
    <div style="font-size:12px;opacity:.9;margin-top:4px">For ${candidate}</div>${refHtml}</div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellMinimal(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, today, content } = ctx
  const markHtml = markBlock(ctx, p.szSm, 'margin-bottom:10px')
  return `<div class="page-inner" style="padding:${p.padLg}">${markHtml}<div style="font-size:11px;color:#6b7280;margin-bottom:6px">${vendor}</div>
    <div style="font-size:${ctx.embed ? '17px' : '20px'};font-weight:600;color:#111827;margin-bottom:8px">Offer Letter</div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:16px">${today} · ${candidate}</div>
    ${bodyWrap(content)}</div>`
}

function shellLuxury(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const mark = markBlock(ctx, p.szMd)
  return `<div class="page-inner"><div style="background:#1f2937;padding:${p.padMd};position:relative;overflow:hidden">
    <div style="position:absolute;top:0;right:0;width:180px;height:100%;background:${ACCENT};opacity:.15;transform:skewX(-15deg) translateX(30px)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;position:relative;gap:16px">
      <div style="display:flex;align-items:center;gap:14px">${mark}<div>
        <div style="font-size:${ctx.embed ? '18px' : '20px'};font-weight:700;color:#fff">${vendor}</div>
        <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:3px">Human Resources</div></div></div>
      <div style="text-align:right"><div style="font-size:11px;color:${ACCENT};text-transform:uppercase;letter-spacing:.2em">Offer Letter</div>
        ${refDiv(ref, 'color:rgba(255,255,255,.5)')}<div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:6px">${today}</div></div></div></div>
    <div style="height:4px;background:${ACCENT}"></div>
    <div style="padding:12px 32px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> ${candidate}</div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellCorporate(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const mark = markBlock(ctx, p.szMd)
  const left = mark
    ? `<div style="display:flex;align-items:center;gap:14px">${mark}<div><div style="font-size:${ctx.embed ? '18px' : '20px'};font-weight:800;color:#111">${vendor}</div><div style="font-size:11px;color:#6b7280;margin-top:3px">Human Resources</div></div></div>`
    : `<div><div style="font-size:${ctx.embed ? '18px' : '20px'};font-weight:800;color:#111">${vendor}</div><div style="font-size:11px;color:#6b7280;margin-top:3px">Human Resources</div></div>`
  return `<div class="page-inner" style="border-left:5px solid ${ACCENT}"><div style="padding:${p.padMd};border-bottom:1px solid #e5e7eb">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">${left}
      <div style="text-align:right;padding-left:20px;border-left:3px solid ${ACCENT};min-width:160px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:${ACCENT};font-weight:700">Offer Letter</div>
        ${refDiv(ref)}<div style="font-size:10px;color:#6b7280;margin-top:6px">Date: ${today}</div></div></div></div>
    <div style="padding:14px 32px;background:#f8fafc;border-bottom:1px solid #e5e7eb"><div style="border-left:4px solid ${ACCENT};padding-left:14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:${ACCENT};font-weight:700;margin-bottom:4px">Candidate</div>
      <div style="font-weight:700;font-size:13px">${candidate}</div></div></div>
    ${bodyWrap(content, p.padSm)}</div>`
}

function shellColorblock(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const sideW = ctx.embed ? '140px' : '200px'
  const markHtml = markBlock(ctx, p.szSm, 'margin-bottom:12px')
  const refHtml = ref ? `<div style="font-size:10px;color:rgba(255,255,255,.55);margin-top:12px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner" style="display:flex;min-height:${ctx.embed ? '360px' : '480px'}"><div style="width:${sideW};background:${ACCENT};flex-shrink:0;padding:24px 16px;color:#fff">
    ${markHtml}<div style="font-size:${ctx.embed ? '13px' : '14px'};font-weight:800;line-height:1.3">${vendor}</div>
    <div style="font-size:9px;opacity:.55;text-transform:uppercase;letter-spacing:.12em;margin:16px 0 6px">Offer Letter</div>
    <div style="font-size:11px;font-weight:600">${today}</div>${refHtml}
    <div style="border-top:1px solid rgba(255,255,255,.2);margin-top:16px;padding-top:14px">
      <div style="font-size:9px;opacity:.55;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Candidate</div>
      <div style="font-size:12px;font-weight:700">${candidate}</div></div></div>
    <div style="flex:1;padding:${p.padMd}">${bodyWrap(content)}</div></div>`
}

function shellCompact(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const mark = markBlock(ctx, p.szSm)
  const left = mark
    ? `<div style="display:flex;align-items:center;gap:10px">${mark}<div><div style="font-size:15px;font-weight:800;color:#111">${vendor}</div><div style="font-size:9px;color:#6b7280">Human Resources</div></div></div>`
    : `<div><div style="font-size:15px;font-weight:800;color:#111">${vendor}</div><div style="font-size:9px;color:#6b7280">Human Resources</div></div>`
  return `<div class="page-inner" style="padding:${p.padMd}"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid ${ACCENT}">${left}
    <div style="text-align:right"><div style="font-size:16px;font-weight:800;color:${ACCENT};letter-spacing:1px">OFFER LETTER</div>
    ${refDiv(ref)}<div style="font-size:9px;color:#9ca3af;margin-top:4px">${today}</div></div></div>
    <div style="margin-bottom:12px;padding:8px 10px;background:#f8fafc;border-radius:4px;font-size:11px"><span style="font-size:9px;text-transform:uppercase;color:#9ca3af;margin-right:6px">Candidate:</span><span style="font-weight:700">${candidate}</span></div>
    ${bodyWrap(content)}</div>`
}

function shellBold(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const mark = markBlock(ctx, p.szMd)
  const left = mark
    ? `<div style="padding:20px 24px;display:flex;align-items:center;gap:14px">${mark}<div><div style="font-size:18px;font-weight:900;color:#fff">${vendor}</div><div style="font-size:9px;color:rgba(255,255,255,.65);margin-top:2px">Human Resources</div></div></div>`
    : `<div style="padding:20px 24px"><div style="font-size:18px;font-weight:900;color:#fff">${vendor}</div><div style="font-size:9px;color:rgba(255,255,255,.65);margin-top:2px">Human Resources</div></div>`
  return `<div class="page-inner"><div style="background:${ACCENT}"><div style="display:flex;justify-content:space-between;align-items:stretch">${left}
    <div style="background:rgba(0,0,0,.18);padding:20px 24px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;min-width:180px">
      <div style="font-size:9px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.15em">Offer Letter</div>
      ${ref ? `<div style="font-size:10px;color:rgba(255,255,255,.7);margin-top:6px">${refLine(ref)}</div>` : ''}
      <div style="font-size:9px;color:rgba(255,255,255,.55);margin-top:6px">${today}</div></div></div></div>
    <div style="background:#1f2937;padding:14px 24px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em">Candidate</div>
      <div style="font-size:13px;font-weight:700;color:#fff;margin-top:2px">${candidate}</div></div></div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellVisual(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const mark = markBlock(ctx, p.szMd)
  const left = mark
    ? `<div style="display:flex;align-items:center;gap:14px">${mark}<div><div style="font-size:${ctx.embed ? '18px' : '20px'};font-weight:800;color:#0f172a">${vendor}</div><div style="font-size:10px;color:#94a3b8;margin-top:3px">Human Resources</div></div></div>`
    : `<div><div style="font-size:${ctx.embed ? '18px' : '20px'};font-weight:800;color:#0f172a">${vendor}</div><div style="font-size:10px;color:#94a3b8;margin-top:3px">Human Resources</div></div>`
  return `<div class="page-inner"><div style="padding:${p.padMd};border-bottom:1px solid #f1f5f9">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px">${left}
      <div style="background:${ACCENT};border-radius:10px;padding:14px 18px;text-align:right;min-width:160px;flex-shrink:0">
        <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.7);font-weight:600">Offer Letter</div>
        ${refDiv(ref, 'color:rgba(255,255,255,.65)')}<div style="font-size:10px;color:rgba(255,255,255,.7);margin-top:6px">${today}</div></div></div></div>
    <div style="padding:14px 32px;border-bottom:1px solid #f1f5f9;font-size:12px"><strong>Candidate:</strong> ${candidate}</div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellCentered(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szLg, 'margin:0 auto 12px;display:flex;justify-content:center')
  const refHtml = ref ? `<div style="font-size:10px;color:#9ca3af;margin-top:8px">Ref: ${ref}</div>` : ''
  return `<div class="page-inner" style="padding:${p.padLg}"><div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${ACCENT}">${markHtml}
    <div style="font-size:${ctx.embed ? '20px' : '22px'};font-weight:700;color:#111">${vendor}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:4px;letter-spacing:.08em;text-transform:uppercase">Offer Letter</div>${refHtml}
    <div style="font-size:11px;color:#6b7280;margin-top:10px">${today}</div></div>
    <div style="text-align:center;font-size:12px;margin-bottom:16px">${candidate}</div>
    ${bodyWrap(content)}</div>`
}

function shellLetterhead(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szLg, 'margin-bottom:12px;display:flex;justify-content:center')
  const refHtml = ref ? `<div style="font-size:11px;color:#6b7280;margin-top:8px">Ref: ${ref}</div>` : ''
  return `<div class="page-inner"><div style="padding:${p.padLg};text-align:center;border-bottom:2px solid ${ACCENT}">${markHtml}
    <div style="font-size:${ctx.embed ? '22px' : '26px'};font-weight:700;color:${ACCENT}">${vendor}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:4px;letter-spacing:.08em;text-transform:uppercase">Official Offer of Employment</div>${refHtml}</div>
    <div style="padding:10px 32px;display:flex;justify-content:space-between;font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb"><span>${candidate}</span><span>${today}</span></div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellBanner(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szSm)
  return `<div class="page-inner"><div style="background:linear-gradient(90deg,${ACCENT} 0%,${ACCENT}dd 100%);padding:18px 28px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="min-width:90px">${markHtml}</div>
      <div style="flex:1;text-align:center"><div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:900;letter-spacing:1px">OFFER LETTER</div>
        <div style="font-size:12px;opacity:.85;margin-top:4px">${vendor}</div></div>
      <div style="min-width:90px;text-align:right;font-size:10px;opacity:.9">${ref ? refLine(ref) : ''}<div style="margin-top:4px">${today}</div></div></div></div>
    <div style="padding:12px 28px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-size:12px"><strong>Candidate:</strong> ${candidate}</div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellExecutive(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szLg)
  return `<div class="page-inner" style="padding:${p.padLg}"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:16px">
    <div style="flex:1"><div style="font-size:11px;font-weight:600;color:${ACCENT};text-transform:uppercase;letter-spacing:.2em;margin-bottom:8px">Offer Letter</div>
      <div style="font-size:${ctx.embed ? '20px' : '24px'};font-weight:700;color:#111">${vendor}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:8px">${today}</div>${refDiv(ref)}
      <div style="font-size:12px;margin-top:12px"><strong>Candidate:</strong> ${candidate}</div></div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">${markHtml}</div></div>
    <div style="height:3px;background:linear-gradient(90deg,${ACCENT},transparent);margin-bottom:20px"></div>
    ${bodyWrap(content)}</div>`
}

function shellStripe(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szSm)
  const refHtml = ref ? `<div style="font-size:10px;color:#6b7280;margin-top:4px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner"><div style="height:6px;background:linear-gradient(90deg,${ACCENT} 33%,#1f2937 33%,#1f2937 66%,${ACCENT} 66%)"></div>
    <div style="padding:18px 28px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;gap:12px">
      <div style="min-width:100px">${markHtml}</div>
      <div style="text-align:center;flex:1"><div style="font-size:${ctx.embed ? '16px' : '19px'};font-weight:800;color:#111">${vendor}</div>
        <div style="font-size:14px;font-weight:700;color:${ACCENT};margin-top:6px;letter-spacing:1px">OFFER LETTER</div>${refHtml}</div>
      <div style="text-align:right;font-size:11px;color:#6b7280;min-width:100px">${today}</div></div>
    <div style="padding:10px 28px;font-size:12px;border-bottom:1px solid #f3f4f6"><strong>Candidate:</strong> ${candidate}</div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellGstpro(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szMd)
  const refHtml = ref ? `<div style="font-size:10px;color:#6b7280;margin-top:4px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner"><div style="display:grid;grid-template-columns:auto 1fr auto;gap:16px;padding:18px 24px;border-bottom:2px solid ${ACCENT};align-items:start">
    <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;background:#f8fafc;min-width:90px;text-align:center">${markHtml || ''}</div>
    <div><div style="font-size:${ctx.embed ? '16px' : '18px'};font-weight:800;color:#111">${vendor}</div>
      <div style="font-size:10px;color:#6b7280;margin-top:4px">Human Resources</div></div>
    <div style="text-align:right;min-width:120px"><div style="background:${ACCENT};color:#fff;padding:8px 14px;border-radius:4px;font-weight:800;font-size:13px;letter-spacing:1px">OFFER LETTER</div>${refHtml}</div></div>
    <div style="padding:14px 24px;display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid #e5e7eb">
      <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden"><div style="background:${ACCENT};color:#fff;font-size:9px;font-weight:700;padding:5px 10px;text-transform:uppercase">Date</div>
        <div style="padding:10px;font-size:11px">${today}</div></div>
      <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden"><div style="background:#f1f5f9;font-size:9px;font-weight:700;padding:5px 10px;text-transform:uppercase;color:#374151">Candidate</div>
        <div style="padding:10px;font-size:12px;font-weight:700">${candidate}</div></div></div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellRetail(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szSm)
  const left = markHtml
    ? `<div style="display:flex;align-items:center;gap:12px">${markHtml}<div><div style="font-size:16px;font-weight:800">${vendor}</div><div style="font-size:9px;opacity:.7;margin-top:2px">Human Resources</div></div></div>`
    : `<div><div style="font-size:16px;font-weight:800">${vendor}</div><div style="font-size:9px;opacity:.7;margin-top:2px">Human Resources</div></div>`
  return `<div class="page-inner"><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:#111;color:#fff">${left}
    <div style="text-align:right"><div style="font-size:9px;opacity:.6;text-transform:uppercase">Offer Letter</div>
      <div style="font-size:14px;font-weight:800;color:${ACCENT};margin-top:4px">${today}</div></div></div>
    <div style="display:flex;justify-content:space-between;padding:10px 20px;background:${ACCENT}15;border-bottom:2px solid ${ACCENT};font-size:11px">
      <span><strong>Candidate:</strong> ${candidate}</span>${ref ? `<span>${refLine(ref)}</span>` : '<span></span>'}</div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellSideright(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szMd)
  const refHtml = ref ? `<div style="font-size:8px;opacity:.75;margin-top:8px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner" style="display:flex;min-height:${ctx.embed ? '320px' : '420px'}"><div style="flex:1;padding:${p.padMd}">
    <div style="margin-bottom:18px"><div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:800;color:${ACCENT}">OFFER LETTER</div>
      <div style="font-size:11px;color:#6b7280;margin-top:6px">${today}</div></div>
    <div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:6px"><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Candidate</div>
      <div style="font-weight:700;font-size:13px">${candidate}</div></div>
    ${bodyWrap(content)}</div>
    <div style="width:${ctx.embed ? '120px' : '150px'};background:${ACCENT};color:#fff;padding:18px 12px;display:flex;flex-direction:column;align-items:center;gap:10px;flex-shrink:0">
      ${markHtml}<div style="text-align:center;font-size:11px;font-weight:700;line-height:1.3">${vendor}</div>${refHtml}</div></div>`
}

function shellFramed(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szMd)
  return `<div class="page-inner" style="border:3px double ${ACCENT};padding:${p.padMd}"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #d1d5db;gap:16px">
    <div style="flex:1"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.2em;color:${ACCENT};font-weight:700">Offer Letter</div>
      <div style="font-size:${ctx.embed ? '18px' : '20px'};font-weight:700;margin-top:6px;color:#111">${vendor}</div>
      <div style="margin-top:8px;font-size:11px;color:#374151">${today}${ref ? ` · ${refLine(ref)}` : ''}</div>
      <div style="font-size:12px;margin-top:10px"><strong>Candidate:</strong> ${candidate}</div></div>
    <div>${markHtml}</div></div>
    ${bodyWrap(content)}</div>`
}

function shellSlimleft(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szMd)
  const refHtml = ref ? `<div style="font-size:8px;color:#9ca3af;margin-top:8px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner" style="display:flex;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden"><div style="width:${ctx.embed ? '130px' : '170px'};background:#f8fafc;border-right:1px solid #e5e7eb;padding:16px 12px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:8px">
    ${markHtml}<div style="text-align:center;font-size:11px;font-weight:800;color:#111;line-height:1.3">${vendor}</div>
    <div style="width:100%;height:2px;background:${ACCENT};margin-top:4px"></div>${refHtml}</div>
    <div style="flex:1;padding:18px 22px"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div style="font-size:${ctx.embed ? '16px' : '20px'};font-weight:800;color:${ACCENT}">OFFER LETTER</div>
      <div style="text-align:right;font-size:11px;color:#6b7280"><div style="margin-top:2px">${today}</div></div></div>
      <div style="margin-bottom:14px;padding:10px 12px;border:1px dashed #d1d5db;border-radius:6px;font-size:12px"><strong>Candidate:</strong> ${candidate}</div>
      ${bodyWrap(content)}</div></div>`
}

function shellPremiumright(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szLg)
  const refHtml = ref ? `<div style="font-size:10px;color:#6b7280;margin-top:6px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner"><div style="padding:20px 28px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
    <div style="flex:1"><div style="display:inline-block;background:${ACCENT};color:#fff;font-size:9px;font-weight:700;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Offer Letter</div>
      <div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:800;color:#111">${vendor}</div>${refHtml}</div>
    <div>${markHtml}</div></div>
    <div style="margin:14px 28px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;border:1px solid #e5e7eb"><div style="font-size:8px;color:#9ca3af;text-transform:uppercase">Date</div><div style="font-weight:600;font-size:11px;margin-top:3px">${today}</div></div>
      <div style="background:${ACCENT}12;border-radius:8px;padding:10px;text-align:center;border:1px solid ${ACCENT}40"><div style="font-size:8px;color:#6b7280;text-transform:uppercase">Candidate</div><div style="font-weight:700;font-size:11px;color:${ACCENT};margin-top:3px">${candidate}</div></div></div>
    ${bodyWrap(content, '20px 28px 24px')}</div>`
}

function shellLeftlogo(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szLg)
  const refHtml = ref ? `<div style="font-size:10px;color:#9ca3af;margin-top:4px">Ref: ${ref}</div>` : ''
  return `<div class="page-inner"><div style="padding:20px 28px;border-bottom:4px double ${ACCENT}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="min-width:100px">${markHtml}</div>
      <div style="flex:1"><div style="font-size:${ctx.embed ? '18px' : '20px'};font-weight:800;color:#111">${vendor}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:3px">Human Resources</div>
        <div style="margin-top:10px;font-size:${ctx.embed ? '15px' : '18px'};font-weight:700;color:${ACCENT};letter-spacing:2px">OFFER LETTER</div>${refHtml}</div>
      <div style="text-align:right;font-size:11px;color:#6b7280"><div>Date: <strong style="color:#111">${today}</strong></div></div></div></div>
    <div style="padding:12px 28px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> ${candidate}</div>
    ${bodyWrap(content, p.padMd)}</div>`
}

function shellRightlogo(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const markHtml = markBlock(ctx, p.szLg)
  const refHtml = ref ? `<div style="font-size:10px;color:#6b7280;margin-top:6px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner"><div style="padding:${p.padMd};border-bottom:3px solid ${ACCENT};display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
    <div style="flex:1"><div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:800;color:${ACCENT};letter-spacing:1px">OFFER LETTER</div>
      <div style="font-size:${ctx.embed ? '16px' : '20px'};font-weight:700;color:#111;margin-top:10px">${vendor}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>${refHtml}
      <div style="font-size:11px;color:#6b7280;margin-top:8px">${today}</div></div>
    <div style="min-width:100px">${markHtml}</div></div>
    <div style="padding:10px 32px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> ${candidate}</div>
    ${bodyWrap(content, p.padSm)}</div>`
}

function shellFooterleft(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const headerMark = markBlock(ctx, p.szMd)
  const headerLeft = headerMark
    ? `<div style="display:flex;align-items:flex-start;gap:14px"><div>${headerMark}</div><div>`
    : '<div>'
  const headerClose = headerMark ? '</div></div>' : '</div>'
  return `<div class="page-inner"><div style="padding:${p.padMd};border-bottom:3px solid ${ACCENT}">
    ${headerLeft}<div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:800;color:${ACCENT};letter-spacing:1px">OFFER LETTER</div>
      <div style="font-size:${ctx.embed ? '16px' : '20px'};font-weight:700;color:#111;margin-top:10px">${vendor}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>${ref ? `<div style="font-size:10px;color:#6b7280;margin-top:6px">${refLine(ref)}</div>` : ''}${headerClose}</div>
    <div style="padding:12px 32px;display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:1px solid #e5e7eb;font-size:11px">
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px"><div style="color:#6b7280;margin-bottom:4px">Date</div><div style="font-weight:600">${today}</div></div>
      <div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Candidate</div><div style="font-weight:700;font-size:13px">${candidate}</div></div></div>
    ${bodyWrap(content, p.padSm)}${footerMarkRow(ctx, p.szSm, 'left')}</div>`
}

function shellFooterright(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const headerMark = markBlock(ctx, p.szMd)
  const headerLeft = headerMark
    ? `<div style="display:flex;align-items:flex-start;gap:14px"><div>${headerMark}</div><div>`
    : '<div>'
  const headerClose = headerMark ? '</div></div>' : '</div>'
  return `<div class="page-inner"><div style="padding:${p.padMd};border-bottom:3px solid ${ACCENT}">
    ${headerLeft}<div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:800;color:${ACCENT};letter-spacing:1px">OFFER LETTER</div>
      <div style="font-size:${ctx.embed ? '16px' : '20px'};font-weight:700;color:#111;margin-top:10px">${vendor}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>${headerClose}</div>
    <div style="padding:12px 32px;display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:1px solid #e5e7eb;font-size:11px">
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px"><div style="color:#6b7280;margin-bottom:4px">Date</div><div style="font-weight:600">${today}</div></div>
      <div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Candidate</div><div style="font-weight:700;font-size:13px">${candidate}</div></div></div>
    ${bodyWrap(content, p.padSm)}${footerMarkRow(ctx, p.szSm, 'right')}</div>`
}

function shellToprightlogobottomleft(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const headerMark = markBlock(ctx, p.szLg)
  const refHtml = ref ? `<div style="font-size:10px;color:#6b7280;margin-top:6px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner"><div style="padding:${p.padMd};border-bottom:3px solid ${ACCENT};display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
    <div style="flex:1"><div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:800;color:${ACCENT};letter-spacing:1px">OFFER LETTER</div>
      <div style="font-size:${ctx.embed ? '16px' : '20px'};font-weight:700;color:#111;margin-top:10px">${vendor}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>${refHtml}
      <div style="font-size:11px;color:#6b7280;margin-top:8px">${today}</div></div>
    <div style="min-width:100px">${headerMark}</div></div>
    <div style="padding:10px 32px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> ${candidate}</div>
    ${bodyWrap(content, p.padSm)}${footerMarkRow(ctx, p.szSm, 'left')}</div>`
}

function shellTopleftlogobottomright(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const headerMark = markBlock(ctx, p.szLg)
  const refHtml = ref ? `<div style="font-size:10px;color:#6b7280;margin-top:6px">${refLine(ref)}</div>` : ''
  return `<div class="page-inner"><div style="padding:${p.padMd};border-bottom:3px solid ${ACCENT};display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
    <div style="min-width:100px">${headerMark}</div>
    <div style="flex:1;text-align:right"><div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:800;color:${ACCENT};letter-spacing:1px">OFFER LETTER</div>
      <div style="font-size:${ctx.embed ? '16px' : '20px'};font-weight:700;color:#111;margin-top:10px">${vendor}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>${refHtml}
      <div style="font-size:11px;color:#6b7280;margin-top:8px">${today}</div></div></div>
    <div style="padding:10px 32px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> ${candidate}</div>
    ${bodyWrap(content, p.padSm)}${footerMarkRow(ctx, p.szSm, 'right')}</div>`
}

function shellOfficialGulf(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const mark = markAt(ctx, p.szLg)
  return `<div class="page-inner">
    <div style="padding:${p.padLg};padding-bottom:16px;display:flex;align-items:center;gap:14px">${mark}
      <div><div style="font-size:${ctx.embed ? '18px' : '22px'};font-weight:800;color:${ACCENT}">${vendor}</div>
      <div style="font-size:10px;color:#16a34a;letter-spacing:.12em;text-transform:uppercase;margin-top:3px">Official Offer of Employment</div></div></div>
    <div style="border-top:1px solid #d1d5db;border-bottom:1px solid #d1d5db;padding:8px 32px;text-align:center;font-size:10px;color:#6b7280">Soft copy of official offer letter — ${vendor}</div>
    <div style="display:flex;justify-content:space-between;padding:10px 32px;font-size:11px">${refLine(ref) || '<span></span>'}<span>Date: ${today}</span></div>
    <div style="padding:8px 32px 14px;border-bottom:1px solid #e5e7eb;font-size:12px"><strong>Employee:</strong> ${candidate}</div>
    <div style="padding:${p.padSm}"><div class="body-content"><div style="font-size:14px;font-weight:700;margin-bottom:12px">Offer of Employment</div>${content}</div></div>
    ${signatureRow()}
    <div style="padding:0 32px 24px;font-size:10px;color:#9ca3af;text-align:center">Please sign and return a scanned copy to Human Resources.</div></div>`
}

function shellEmploymentFormal(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, ref, today, content } = ctx
  const mark = markAt(ctx, p.szMd)
  const headerRow = mark
    ? `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px;font-size:11px;color:#4b5563"><div>${mark}</div><span>Date: ${today}</span></div>`
    : `<div style="display:flex;justify-content:flex-end;font-size:11px;color:#4b5563;margin-bottom:18px"><span>Date: ${today}</span></div>`
  return `<div class="page-inner" style="padding:${p.padLg}">
    <div style="text-align:center;font-size:${ctx.embed ? '15px' : '17px'};font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Employment Offer Letter</div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#4b5563;margin-bottom:10px"><span>${ref ? refLine(ref) : 'Reference: —'}</span></div>
    ${headerRow}
    <div style="font-size:12px;margin-bottom:14px"><strong>Candidate:</strong> ${candidate}</div>
    <div class="body-content"><div style="font-size:13px;font-weight:700;margin-bottom:10px">Summary of employment terms</div>${content}</div>
    ${signatureRow()}</div>`
}

function shellBrandedBands(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, today, content } = ctx
  const mark = markAt(ctx, p.szMd)
  const leftHeader = mark
    ? `<div style="display:flex;align-items:center;gap:12px;min-width:0"><div>${mark}</div><div><div style="font-size:${ctx.embed ? '16px' : '18px'};font-weight:800;color:#0f766e">${vendor}</div><div style="font-size:10px;color:#6b7280;margin-top:4px">Human Resources Department</div></div></div>`
    : `<div style="min-width:0"><div style="font-size:${ctx.embed ? '16px' : '18px'};font-weight:800;color:#0f766e">${vendor}</div><div style="font-size:10px;color:#6b7280;margin-top:4px">Human Resources Department</div></div>`
  return `<div class="page-inner">
    <div style="height:10px;background:linear-gradient(105deg,#f97316 0%,#f97316 32%,#0d9488 32%,#0d9488 100%)"></div>
    <div style="padding:20px 32px 12px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">${leftHeader}
      <div style="text-align:right;font-size:${ctx.embed ? '13px' : '15px'};font-weight:800;text-transform:uppercase">Job Offer Letter</div></div>
    <div style="margin:0 32px;border-top:1px solid #e5e7eb"></div>
    <div style="padding:8px 32px 0;display:flex;justify-content:space-between;font-size:11px;color:#6b7280"><span>${vendor}</span><span>${today}</span></div>
    <div style="padding:16px 32px 8px;font-size:12px"><strong>To:</strong> ${candidate}</div>
    <div style="padding:0 32px 24px"><div class="body-content">${content}</div></div>
    <div style="padding:0 32px 28px;font-size:12px"><div>Warm regards,</div><div style="margin-top:28px;font-weight:600">${vendor}</div><div style="font-size:11px;color:#6b7280">Human Resources</div></div>
    <div style="height:10px;background:linear-gradient(105deg,#0d9488 0%,#0d9488 68%,#f97316 68%,#f97316 100%)"></div></div>`
}

function shellClassicFormal(ctx: OfferShellCtx, p: PadVals): string {
  const { vendor, candidate, today, content } = ctx
  const mark = markAt(ctx, p.szMd)
  const markHtml = mark ? `<div style="display:flex;justify-content:center;margin-bottom:14px">${mark}</div>` : ''
  return `<div class="page-inner" style="padding:${p.padLg}">${markHtml}
    <div style="text-align:center;font-size:${ctx.embed ? '16px' : '18px'};font-weight:700;margin-bottom:20px">Offer Letter</div>
    <div style="font-size:12px;margin-bottom:16px">${today}</div>
    <div style="font-size:12px;margin-bottom:16px">${candidate}</div>
    <div class="body-content">${content}</div>
    <div style="margin-top:28px;font-size:12px"><div>Sincerely,</div><div style="margin-top:40px;font-weight:600">${vendor}</div><div style="color:#6b7280">Human Resources</div></div></div>`
}

const SHELLS: Record<string, ShellFn> = {
  classic: shellClassic,
  modern: shellModern,
  minimal: shellMinimal,
  luxury: shellLuxury,
  corporate: shellCorporate,
  colorblock: shellColorblock,
  compact: shellCompact,
  bold: shellBold,
  visual: shellVisual,
  centered: shellCentered,
  letterhead: shellLetterhead,
  banner: shellBanner,
  executive: shellExecutive,
  stripe: shellStripe,
  gstpro: shellGstpro,
  retail: shellRetail,
  sideright: shellSideright,
  framed: shellFramed,
  slimleft: shellSlimleft,
  premiumright: shellPremiumright,
  leftlogo: shellLeftlogo,
  rightlogo: shellRightlogo,
  footerleft: shellFooterleft,
  footerright: shellFooterright,
  toprightlogobottomleft: shellToprightlogobottomleft,
  topleftlogobottomright: shellTopleftlogobottomright,
  official_gulf: shellOfficialGulf,
  employment_formal: shellEmploymentFormal,
  branded_bands: shellBrandedBands,
  classic_formal: shellClassicFormal,
}

export function renderOfferLayoutShell(layoutId: string, ctx: OfferShellCtx): string {
  const id = normalizeOfferLayoutId(layoutId)
  const fn = SHELLS[id] ?? SHELLS.classic
  return fn(ctx, pads(ctx.embed))
}
