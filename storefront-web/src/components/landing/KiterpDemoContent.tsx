import {
  ArrowUpRight,
  Bell,
  CreditCard,
  Image as ImageIcon,
  LayoutGrid,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
} from 'lucide-react'
import {
  FinanceTabView,
  HrTabView,
  InboxTabView,
  OrdersTabView,
  PosTabView,
  SeoTabView,
  StorefrontTabView,
  WebsiteTabView,
} from './campaignDemoTabViews'
import { normalizeDemoNavKey } from './campaignDemoNav'

/** Per-scene mock UI shown inside the browser demo. */
export function DemoSceneContent({
  sceneId,
  activeMenuItem,
}: {
  sceneId: string
  activeMenuItem?: string
}) {
  const menu = activeMenuItem ?? ''

  switch (sceneId) {
    case 'dashboard':
      return <DashboardContent />
    case 'crm':
      return <CrmContent />
    case 'products':
      return <ProductsContent />
    case 'orders':
      return <OrdersTabView menuItem={menu} />
    case 'website':
      return <WebsiteTabView menuItem={menu} />
    case 'pos':
      return normalizeDemoNavKey(menu) === 'register' || !menu
        ? <PosContent />
        : <PosTabView menuItem={menu} />
    case 'finance':
      return normalizeDemoNavKey(menu) === 'ledger' || !menu
        ? <FinanceContent />
        : <FinanceTabView menuItem={menu} />
    case 'inbox':
      return normalizeDemoNavKey(menu) === 'inbox' || !menu
        ? <InboxContent />
        : <InboxTabView menuItem={menu} />
    case 'workspace':
      return <WorkspaceContent />
    case 'form':
      return <FormRecordContent />
    case 'seo':
      return <SeoTabView menuItem={menu} />
    case 'storefront':
      return <StorefrontTabView menuItem={menu} />
    case 'hr':
      return normalizeDemoNavKey(menu) === 'employees' || !menu
        ? <HrContent />
        : <HrTabView menuItem={menu} />
    case 'analytics':
      return <AnalyticsContent />
    case 'production':
      return <ProductionContent />
    case 'settings':
      return <SettingsContent />
    default:
      return <DashboardContent />
  }
}

function CrmContent() {
  const columns: { stage: string; tone: string; deals: [string, string][] }[] = [
    { stage: 'New', tone: 'amber', deals: [['Acme Retail', '₹40K'], ['Bright Cafe', '₹18K']] },
    { stage: 'Qualified', tone: 'blue', deals: [['Nova Store', '₹65K'], ['Peak Gym', '₹22K']] },
    { stage: 'Won', tone: 'green', deals: [['Urban Mart', '₹90K']] },
  ]
  return (
    <div className="democ democ-row democ-grow">
      {columns.map((col) => (
        <div key={col.stage} className="democ-crm-col">
          <div className="democ-crm-colhead">
            <span>{col.stage}</span>
            <span className={`democ-dot ${col.tone}`} />
          </div>
          {col.deals.map(([name, value]) => (
            <div key={name} className="democ-crm-card">
              <span className="democ-crm-name">{name}</span>
              <div className="democ-crm-meta">
                <span className="democ-avatar" />
                <span className="democ-crm-value">{value}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Bars({ values, accent }: { values: number[]; accent?: boolean }) {
  return (
    <div className="democ-bars">
      {values.map((v, i) => (
        <span
          key={i}
          className={`democ-bar${accent && i === values.length - 2 ? ' is-accent' : ''}`}
          style={{ height: `${v}%` }}
        />
      ))}
    </div>
  )
}

function DashboardContent() {
  return (
    <div className="democ">
      <div className="democ-tiles">
        <div className="democ-tile">
          <span className="democ-tile-label">Revenue</span>
          <strong className="democ-tile-value">₹2.4L</strong>
          <span className="democ-delta up"><ArrowUpRight className="w-3 h-3" />12%</span>
        </div>
        <div className="democ-tile">
          <span className="democ-tile-label">Orders</span>
          <strong className="democ-tile-value">128</strong>
          <span className="democ-delta up"><ArrowUpRight className="w-3 h-3" />8%</span>
        </div>
        <div className="democ-tile">
          <span className="democ-tile-label">Visitors</span>
          <strong className="democ-tile-value">3,902</strong>
          <span className="democ-delta up"><ArrowUpRight className="w-3 h-3" />21%</span>
        </div>
      </div>
      <div className="democ-row democ-grow">
        <div className="democ-panel democ-flex2">
          <div className="democ-panel-head">Sales this week</div>
          <Bars values={[42, 58, 38, 72, 55, 88, 64]} accent />
        </div>
        <div className="democ-panel democ-flex1">
          <div className="democ-panel-head">Recent orders</div>
          <ul className="democ-list">
            {[
              ['#1042', '₹1,250', 'green'],
              ['#1041', '₹780', 'amber'],
              ['#1040', '₹2,140', 'green'],
            ].map(([id, amt, tone]) => (
              <li key={id} className="democ-listrow">
                <span className="democ-avatar" />
                <span className="democ-listrow-id">{id}</span>
                <span className="democ-listrow-amt">{amt}</span>
                <span className={`democ-dot ${tone}`} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function ProductsContent() {
  const items = [
    ['Wireless Earbuds', '₹1,999', 'In stock', 'green'],
    ['Cotton T-Shirt', '₹499', 'Low stock', 'amber'],
    ['Steel Bottle', '₹349', 'In stock', 'green'],
    ['Yoga Mat', '₹899', 'Draft', 'gray'],
  ]
  return (
    <div className="democ">
      <div className="democ-products">
        {items.map(([name, price, label, tone]) => (
          <div key={name} className="democ-product">
            <div className="democ-thumb"><Package className="w-4 h-4" /></div>
            <div className="democ-product-body">
              <span className="democ-product-name">{name}</span>
              <span className="democ-product-price">{price}</span>
            </div>
            <span className={`democ-badge ${tone}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrdersContent() {
  const rows = [
    ['#1042', 'Aarav S.', 'Delivered', '₹1,250', 'green'],
    ['#1041', 'Meera K.', 'Packed', '₹780', 'blue'],
    ['#1040', 'Rohan P.', 'New', '₹2,140', 'amber'],
    ['#1039', 'Diya M.', 'Delivered', '₹560', 'green'],
  ]
  return (
    <div className="democ">
      <div className="democ-panel democ-grow">
        <div className="democ-table">
          <div className="democ-tr democ-thead">
            <span>Order</span><span>Customer</span><span>Status</span><span className="ta-r">Total</span>
          </div>
          {rows.map(([id, cust, status, total, tone]) => (
            <div key={id} className="democ-tr">
              <span className="democ-strong">{id}</span>
              <span>{cust}</span>
              <span><i className={`democ-badge ${tone}`}>{status}</i></span>
              <span className="ta-r democ-strong">{total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WebsiteContent() {
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

function PosContent() {
  const products = ['Coffee', 'Burger', 'Fries', 'Salad', 'Soda', 'Cake']
  return (
    <div className="democ democ-row democ-grow">
      <div className="democ-pos-grid democ-flex2">
        {products.map((p) => (
          <div key={p} className="democ-pos-btn"><ShoppingBag className="w-3.5 h-3.5" />{p}</div>
        ))}
      </div>
      <div className="democ-ticket democ-flex1">
        <div className="democ-panel-head">Ticket</div>
        <ul className="democ-ticket-list">
          <li><span>Coffee × 2</span><span>₹160</span></li>
          <li><span>Burger × 1</span><span>₹220</span></li>
          <li><span>Fries × 1</span><span>₹90</span></li>
        </ul>
        <div className="democ-ticket-total">
          <span>Total</span><strong>₹470</strong>
        </div>
        <div className="democ-pos-pay"><CreditCard className="w-3.5 h-3.5" />Charge</div>
      </div>
    </div>
  )
}

function FinanceContent() {
  return (
    <div className="democ">
      <div className="democ-tiles">
        <div className="democ-tile">
          <span className="democ-tile-label">Income</span>
          <strong className="democ-tile-value">₹6.8L</strong>
          <span className="democ-delta up"><ArrowUpRight className="w-3 h-3" />9%</span>
        </div>
        <div className="democ-tile">
          <span className="democ-tile-label">Expenses</span>
          <strong className="democ-tile-value">₹4.1L</strong>
          <span className="democ-delta">−3%</span>
        </div>
        <div className="democ-tile">
          <span className="democ-tile-label">Net margin</span>
          <strong className="democ-tile-value">18.4%</strong>
          <span className="democ-delta up"><ArrowUpRight className="w-3 h-3" />2%</span>
        </div>
      </div>
      <div className="democ-row democ-grow">
        <div className="democ-panel democ-flex2">
          <div className="democ-panel-head">Profit &amp; Loss</div>
          <Bars values={[50, 62, 48, 70, 60, 82]} accent />
        </div>
        <div className="democ-panel democ-flex1">
          <div className="democ-panel-head">Ledger</div>
          <ul className="democ-list">
            {[
              ['Sales', '+₹2.4L', 'green'],
              ['Payroll', '−₹0.9L', 'amber'],
              ['Supplies', '−₹0.3L', 'amber'],
            ].map(([label, amt, tone]) => (
              <li key={label} className="democ-listrow">
                <span className="democ-listrow-id">{label}</span>
                <span className="democ-listrow-amt">{amt}</span>
                <span className={`democ-dot ${tone}`} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function InboxContent() {
  const items: [string, string, string, boolean][] = [
    ['Leave approval', 'Priya S. · 2d ago', 'Pending', true],
    ['Customer inquiry', 'WhatsApp · 1h ago', 'Unread', false],
    ['Low stock alert', 'Inventory · today', 'New', false],
    ['Payment received', 'Finance · today', 'Read', false],
  ]
  return (
    <div className="democ democ-row democ-grow democ-inbox">
      <div className="democ-inbox-list democ-flex1">
        <div className="democ-panel-head">Inbox</div>
        {items.map(([title, meta, badge, selected]) => (
          <div key={title} className={`democ-inbox-item${selected ? ' is-selected' : ''}`}>
            <span className="democ-inbox-item-title">{title}</span>
            <span className="democ-inbox-item-meta">{meta}</span>
            <span className={`democ-badge ${badge === 'Pending' ? 'amber' : badge === 'Unread' ? 'blue' : 'gray'}`}>
              {badge}
            </span>
          </div>
        ))}
      </div>
      <div className="democ-inbox-detail democ-flex1">
        <div className="democ-panel-head">Leave approval</div>
        <p className="democ-inbox-detail-line">Employee: Priya Sharma</p>
        <p className="democ-inbox-detail-line">Dates: 28 Aug – 30 Aug</p>
        <div className="democ-inbox-actions">
          <span className="democ-inbox-btn democ-inbox-btn--primary">Approve</span>
          <span className="democ-inbox-btn">Review</span>
        </div>
      </div>
    </div>
  )
}

function WorkspaceContent() {
  const apps = [
    ['Sales', ShoppingBag],
    ['Inventory', Package],
    ['Finance', CreditCard],
    ['HR', Bell],
    ['CRM', LayoutGrid],
    ['POS', Receipt],
  ] as const
  return (
    <div className="democ democ-workspace">
      <div className="democ-panel-head">My workspace</div>
      <div className="democ-workspace-grid">
        {apps.map(([label, Icon]) => (
          <div key={label} className="democ-workspace-tile">
            <span className="democ-workspace-icon">
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FormRecordContent() {
  return (
    <div className="democ democ-form">
      <p className="democ-form-id">DOC/2026/08/0042</p>
      <div className="democ-form-fields">
        <div className="democ-form-field"><span /><span className="democ-form-field-val" /></div>
        <div className="democ-form-field"><span /><span className="democ-form-field-val democ-form-field-val--short" /></div>
      </div>
      <div className="democ-form-tabs">
        <span className="is-active">Lines</span><span>Details</span><span>Notes</span>
      </div>
      <div className="democ-table">
        <div className="democ-tr democ-thead">
          <span>Item</span><span>Qty</span><span className="ta-r">Amount</span>
        </div>
        {[
          ['Consulting day', '2', '₹18,000'],
          ['Travel allowance', '1', '₹2,400'],
          ['Materials', '5', '₹4,100'],
        ].map(([item, qty, amt]) => (
          <div key={item} className="democ-tr democ-form-row">
            <span className="democ-strong">{item}</span>
            <span>{qty}</span>
            <span className="ta-r democ-strong">{amt}</span>
          </div>
        ))}
      </div>
      <div className="democ-form-total"><span>Total</span><strong>₹24,500</strong></div>
    </div>
  )
}

function SeoContent() {
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
      <div className="democ-seo-posts">
        <div className="democ-panel-head">Scheduled posts</div>
        {[
          ['GST checklist for SMEs', 'Draft'],
          ['5 ways to reduce stockouts', 'Scheduled'],
        ].map(([title, status]) => (
          <div key={title} className="democ-seo-post">
            <span>{title}</span>
            <span className={`democ-badge ${status === 'Scheduled' ? 'green' : 'gray'}`}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StorefrontContent() {
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

function HrContent() {
  return (
    <div className="democ democ-hr">
      <div className="democ-tiles">
        <div className="democ-tile">
          <span className="democ-tile-label">Present today</span>
          <strong className="democ-tile-value">42</strong>
        </div>
        <div className="democ-tile">
          <span className="democ-tile-label">On leave</span>
          <strong className="democ-tile-value">3</strong>
        </div>
        <div className="democ-tile">
          <span className="democ-tile-label">Open roles</span>
          <strong className="democ-tile-value">2</strong>
        </div>
      </div>
      <div className="democ-table democ-hr-table">
        <div className="democ-tr democ-thead">
          <span>Employee</span><span>Dept</span><span>Status</span>
        </div>
        {[
          ['Priya Sharma', 'Sales', 'Present'],
          ['Arjun Mehta', 'Warehouse', 'Present'],
          ['Neha Gupta', 'Finance', 'Leave'],
        ].map(([name, dept, status]) => (
          <div key={name} className="democ-tr democ-hr-row">
            <span className="democ-strong">{name}</span>
            <span>{dept}</span>
            <span><i className={`democ-badge ${status === 'Leave' ? 'amber' : 'green'}`}>{status}</i></span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsContent() {
  return (
    <div className="democ">
      <div className="democ-row democ-grow">
        <div className="democ-panel democ-flex2">
          <div className="democ-panel-head">Plan vs actual</div>
          <Bars values={[62, 58, 71, 54, 68, 49]} accent />
        </div>
        <div className="democ-panel democ-flex1 democ-analytics-variance">
          <div className="democ-panel-head">Variance</div>
          {[
            ['Materials', '−6.2%', 'amber'],
            ['Labour', '+2.1%', 'green'],
            ['Overhead', '−1.4%', 'amber'],
          ].map(([label, val, tone]) => (
            <div key={label} className="democ-analytics-row">
              <span>{label}</span>
              <span className={`democ-analytics-val democ-analytics-val--${tone}`}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProductionContent() {
  const cols = [
    { stage: 'Planned', items: ['MO-1042', 'MO-1045'] },
    { stage: 'In progress', items: ['MO-1038'] },
    { stage: 'Done', items: ['MO-1031', 'MO-1034'] },
  ]
  return (
    <div className="democ democ-row democ-grow democ-production">
      {cols.map((col) => (
        <div key={col.stage} className="democ-production-col">
          <div className="democ-production-stage">{col.stage}</div>
          {col.items.map((mo) => (
            <div key={mo} className="democ-production-card">
              <span className="democ-strong">{mo}</span>
              <span>Qty 120 · WC-02</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function SettingsContent() {
  return (
    <div className="democ democ-settings">
      <div className="democ-settings-group">
        <div className="democ-panel-head">Integrations</div>
        {['Payment gateway', 'SMS alerts', 'Accounting export'].map((item) => (
          <div key={item} className="democ-settings-row">
            <span>{item}</span>
            <span className="democ-settings-toggle is-on" aria-hidden />
          </div>
        ))}
      </div>
      <div className="democ-settings-group">
        <div className="democ-panel-head">Modules enabled</div>
        <div className="democ-workspace-grid democ-settings-modules">
          {['Sales', 'HR', 'Finance', 'CRM', 'Inventory', 'Website'].map((m) => (
            <div key={m} className="democ-workspace-tile democ-settings-module">{m}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
