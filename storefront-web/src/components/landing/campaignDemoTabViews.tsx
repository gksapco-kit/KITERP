import { Image as ImageIcon, Plus } from 'lucide-react'
import { normalizeDemoNavKey } from './campaignDemoNav'

export function WebsiteTabView({ menuItem }: { menuItem: string }) {
  const tab = normalizeDemoNavKey(menuItem)

  if (tab === 'pages') {
    return (
      <div className="democ democ-pages">
        <div className="democ-panel-head">Site pages</div>
        <div className="democ-pages-list">
          {[
            ['Home', 'Live', true],
            ['Shop', 'Draft', false],
            ['Contact', 'Draft', false],
            ['About', 'Draft', false],
          ].map(([name, status, selected]) => (
            <div key={name} className={`democ-pages-row${selected ? ' is-selected' : ''}`}>
              <span className="democ-pages-name">{name}</span>
              <span className={`democ-badge ${status === 'Live' ? 'green' : 'gray'}`}>{status}</span>
              <span className="democ-pages-action">Edit</span>
            </div>
          ))}
        </div>
        <span className="democ-pages-add"><Plus className="w-3 h-3" /> New page</span>
      </div>
    )
  }

  if (tab === 'theme') {
    return (
      <div className="democ democ-theme">
        <div className="democ-theme-section">
          <span className="democ-theme-label">Brand colors</span>
          <div className="democ-theme-swatches">
            {['#1e3d34', '#64c3a0', '#f4a261', '#ffffff'].map((color) => (
              <span key={color} className="democ-theme-swatch" style={{ background: color }} />
            ))}
          </div>
        </div>
        <div className="democ-theme-section">
          <span className="democ-theme-label">Heading font</span>
          <span className="democ-theme-font">Plus Jakarta Sans</span>
        </div>
        <div className="democ-theme-preview">
          <strong>Preview</strong>
          <p>Your headline and body text update live across every page.</p>
        </div>
      </div>
    )
  }

  if (tab === 'publish') {
    return (
      <div className="democ democ-publish">
        <div className="democ-publish-status">
          <span className="democ-badge green">Ready to publish</span>
          <span className="democ-publish-meta">Last saved 2 min ago</span>
        </div>
        <div className="democ-publish-url">
          <span className="democ-publish-label">Live URL</span>
          <span className="democ-publish-value">yourbrand.kiterp.store</span>
        </div>
        <span className="democ-publish-btn">Publish changes</span>
        <div className="democ-publish-checklist">
          {['Home page', 'Theme', 'SEO basics'].map((item) => (
            <div key={item} className="democ-publish-check">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="democ democ-row democ-grow">
      <div className="democ-palette">
        {['Hero', 'Grid', 'Banner', 'Footer'].map((b) => (
          <span key={b} className="democ-palette-item" data-palette-block={b}>
            <Plus className="w-3 h-3" />
            {b}
          </span>
        ))}
      </div>
      <div className="democ-canvas democ-grow">
        <div className="democ-block democ-block-hero">
          <ImageIcon className="w-4 h-4" /> Hero banner
        </div>
        <div className="democ-block-row">
          <div className="democ-block sm" />
          <div className="democ-block sm" />
          <div className="democ-block sm" />
        </div>
        <div className="democ-block democ-block-footer" />
      </div>
    </div>
  )
}

export function StorefrontTabView({ menuItem }: { menuItem: string }) {
  const tab = normalizeDemoNavKey(menuItem)

  if (tab === 'banners') {
    return (
      <div className="democ democ-pages">
        <div className="democ-panel-head">Store banners</div>
        <div className="democ-pages-list">
          {[
            ['Summer sale hero', 'Active'],
            ['Free shipping strip', 'Active'],
            ['New arrivals', 'Scheduled'],
          ].map(([name, status]) => (
            <div key={name} className="democ-pages-row">
              <span className="democ-pages-name">{name}</span>
              <span className={`democ-badge ${status === 'Active' ? 'green' : 'amber'}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tab === 'featured') {
    return (
      <div className="democ democ-storefront-featured">
        <div className="democ-panel-head">Featured products</div>
        <div className="democ-storefront-grid">
          {['Handmade soap', 'Organic tea', 'Gift hamper'].map((name) => (
            <div key={name} className="democ-storefront-product is-featured">
              <span className="democ-storefront-thumb" />
              <span className="democ-storefront-name">{name}</span>
              <span className="democ-storefront-pin">Pinned</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tab === 'preview') {
    return (
      <div className="democ democ-storefront">
        <div className="democ-storefront-hero democ-storefront-block">Featured summer sale · Up to 30% off</div>
        <div className="democ-storefront-grid">
          {['Handmade soap', 'Organic tea', 'Gift hamper', 'Candles'].map((name) => (
            <div key={name} className="democ-storefront-product">
              <span className="democ-storefront-thumb" />
              <span className="democ-storefront-name">{name}</span>
              <span className="democ-storefront-price">₹499</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="democ democ-row democ-grow">
      <div className="democ-palette">
        {['Header', 'Hero', 'Grid', 'Footer'].map((b) => (
          <span key={b} className="democ-palette-item" data-palette-block={b}>
            <Plus className="w-3 h-3" />
            {b}
          </span>
        ))}
      </div>
      <div className="democ-canvas democ-grow">
        <div className="democ-block democ-block-hero democ-block--compact">Store header</div>
        <div className="democ-block democ-block-banner">Hero banner slot</div>
        <div className="democ-block-row">
          <div className="democ-block sm" />
          <div className="democ-block sm" />
          <div className="democ-block sm" />
        </div>
      </div>
    </div>
  )
}

export function SeoTabView({ menuItem }: { menuItem: string }) {
  const tab = normalizeDemoNavKey(menuItem)

  if (tab === 'blog') {
    return (
      <div className="democ democ-seo-posts-only">
        <div className="democ-panel-head">Blog posts</div>
        {[
          ['GST checklist for SMEs', 'Draft'],
          ['5 ways to reduce stockouts', 'Scheduled'],
          ['Inventory tips for Q3', 'Published'],
        ].map(([title, status]) => (
          <div key={title} className="democ-seo-post">
            <span>{title}</span>
            <span className={`democ-badge ${status === 'Scheduled' || status === 'Published' ? 'green' : 'gray'}`}>
              {status}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'redirects') {
    return (
      <div className="democ democ-pages">
        <div className="democ-panel-head">URL redirects</div>
        <div className="democ-pages-list">
          {[
            ['/old-shop', '/shop', '301'],
            ['/sale-2025', '/offers', '302'],
          ].map(([from, to, code]) => (
            <div key={from} className="democ-pages-row">
              <span className="democ-pages-name">{from}</span>
              <span className="democ-pages-action">→ {to}</span>
              <span className="democ-badge gray">{code}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tab === 'sitemap') {
    return (
      <div className="democ democ-publish">
        <div className="democ-publish-status">
          <span className="democ-badge green">Sitemap generated</span>
          <span className="democ-publish-meta">42 URLs indexed</span>
        </div>
        <div className="democ-publish-checklist">
          {['Home', 'Shop', 'Blog', 'Contact'].map((item) => (
            <div key={item} className="democ-publish-check">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="democ democ-seo">
      <div className="democ-seo-fields">
        <div className="democ-seo-field">
          <span className="democ-seo-label">Meta title</span>
          <span className="democ-seo-value">Summer collection — Your Brand</span>
        </div>
        <div className="democ-seo-field">
          <span className="democ-seo-label">Description</span>
          <span className="democ-seo-value democ-seo-value--long">Shop new arrivals with free delivery this week.</span>
        </div>
        <div className="democ-seo-preview">
          <span className="democ-seo-preview-url">yourbrand.com › blog › summer-drop</span>
          <strong>Summer collection launch</strong>
          <p>Preview how this page appears in Google search results.</p>
        </div>
      </div>
    </div>
  )
}

export function OrdersTabView({ menuItem }: { menuItem: string }) {
  const tab = normalizeDemoNavKey(menuItem)
  const configs: Record<string, { head: string; rows: string[][] }> = {
    quotations: {
      head: 'Open quotations',
      rows: [
        ['QT/104', 'Nova Store', 'Sent', '₹65,000'],
        ['QT/103', 'Peak Gym', 'Draft', '₹22,000'],
        ['QT/102', 'Bright Cafe', 'Sent', '₹18,500'],
      ],
    },
    invoices: {
      head: 'Customer invoices',
      rows: [
        ['INV/882', 'Urban Mart', 'Paid', '₹90,000'],
        ['INV/881', 'Aarav S.', 'Due', '₹1,250'],
        ['INV/880', 'Meera K.', 'Paid', '₹780'],
      ],
    },
    returns: {
      head: 'Return orders',
      rows: [
        ['RT/019', 'Diya M.', 'Approved', '₹560'],
        ['RT/018', 'Rohan P.', 'Pending', '₹2,140'],
      ],
    },
  }
  const cfg = configs[tab] ?? {
    head: 'Sales orders',
    rows: [
      ['#1042', 'Aarav S.', 'Delivered', '₹1,250'],
      ['#1041', 'Meera K.', 'Packed', '₹780'],
      ['#1040', 'Rohan P.', 'New', '₹2,140'],
    ],
  }

  return (
    <div className="democ">
      <div className="democ-panel democ-grow">
        <div className="democ-panel-head">{cfg.head}</div>
        <div className="democ-table">
          <div className="democ-tr democ-thead">
            <span>Ref</span><span>Customer</span><span>Status</span><span className="ta-r">Total</span>
          </div>
          {cfg.rows.map(([id, cust, status, total]) => (
            <div key={id} className="democ-tr">
              <span className="democ-strong">{id}</span>
              <span>{cust}</span>
              <span><i className="democ-badge gray">{status}</i></span>
              <span className="ta-r democ-strong">{total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PosTabView({ menuItem }: { menuItem: string }) {
  const tab = normalizeDemoNavKey(menuItem)

  if (tab === 'orders') {
    return (
      <div className="democ democ-pages">
        <div className="democ-panel-head">POS orders today</div>
        <div className="democ-pages-list">
          {[
            ['#POS-88', '₹470', 'Paid'],
            ['#POS-87', '₹220', 'Paid'],
            ['#POS-86', '₹160', 'Refunded'],
          ].map(([id, amt, status]) => (
            <div key={id} className="democ-pages-row">
              <span className="democ-pages-name">{id}</span>
              <span>{amt}</span>
              <span className={`democ-badge ${status === 'Paid' ? 'green' : 'amber'}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tab === 'sessions') {
    return (
      <div className="democ democ-publish">
        <div className="democ-publish-status">
          <span className="democ-badge green">Session open</span>
          <span className="democ-publish-meta">Cashier: Priya · Register 1</span>
        </div>
        <div className="democ-publish-checklist">
          {['Opening float ₹2,000', '42 tickets today', '₹18,420 collected'].map((item) => (
            <div key={item} className="democ-publish-check">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export function FinanceTabView({ menuItem }: { menuItem: string }) {
  const tab = normalizeDemoNavKey(menuItem)
  const lists: Record<string, [string, string][]> = {
    receivables: [
      ['Urban Mart', '₹90,000 due'],
      ['Nova Store', '₹65,000 due'],
    ],
    payables: [
      ['Supplier Co.', '₹42,000 due'],
      ['Logistics Ltd.', '₹8,400 due'],
    ],
    reports: [
      ['P&L summary', 'Ready'],
      ['Balance sheet', 'Ready'],
    ],
  }
  const rows = lists[tab]
  if (!rows) return null

  return (
    <div className="democ democ-pages">
      <div className="democ-panel-head">{menuItem}</div>
      <div className="democ-pages-list">
        {rows.map(([name, meta]) => (
          <div key={name} className="democ-pages-row">
            <span className="democ-pages-name">{name}</span>
            <span className="democ-pages-action">{meta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function InboxTabView({ menuItem }: { menuItem: string }) {
  const tab = normalizeDemoNavKey(menuItem)
  if (tab === 'inbox') return null

  const items: Record<string, [string, string][]> = {
    sent: [
      ['Payment reminder', 'Sent 1d ago'],
      ['Quote follow-up', 'Sent 3d ago'],
    ],
    approvals: [
      ['Leave approval', 'Pending'],
      ['Purchase request', 'Pending'],
    ],
  }
  const rows = items[tab]
  if (!rows) return null

  return (
    <div className="democ democ-pages">
      <div className="democ-panel-head">{menuItem}</div>
      <div className="democ-pages-list">
        {rows.map(([title, meta]) => (
          <div key={title} className="democ-pages-row">
            <span className="democ-pages-name">{title}</span>
            <span className="democ-badge gray">{meta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HrTabView({ menuItem }: { menuItem: string }) {
  const tab = normalizeDemoNavKey(menuItem)
  if (tab === 'employees') return null

  const stats: Record<string, [string, string][]> = {
    attendance: [
      ['Present today', '42'],
      ['Late check-ins', '2'],
    ],
    leave: [
      ['On leave', '3'],
      ['Pending requests', '1'],
    ],
    payroll: [
      ['Payroll run', 'Aug 2026'],
      ['Total payout', '₹9.2L'],
    ],
  }
  const rows = stats[tab]
  if (!rows) return null

  return (
    <div className="democ">
      <div className="democ-tiles">
        {rows.map(([label, value]) => (
          <div key={label} className="democ-tile">
            <span className="democ-tile-label">{label}</span>
            <strong className="democ-tile-value">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
