import {
  ArrowUpRight,
  CreditCard,
  Image as ImageIcon,
  Package,
  Plus,
  ShoppingBag,
} from 'lucide-react'

/** Per-scene mock UI shown inside the browser demo. */
export function DemoSceneContent({ sceneId }: { sceneId: string }) {
  switch (sceneId) {
    case 'dashboard':
      return <DashboardContent />
    case 'crm':
      return <CrmContent />
    case 'products':
      return <ProductsContent />
    case 'orders':
      return <OrdersContent />
    case 'website':
      return <WebsiteContent />
    case 'pos':
      return <PosContent />
    case 'finance':
      return <FinanceContent />
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
          <span key={b} className="democ-palette-item"><Plus className="w-3 h-3" />{b}</span>
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
