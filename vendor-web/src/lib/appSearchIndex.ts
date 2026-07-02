import type { ElementType } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavSection {
  id: string
  title: string
  icon: ElementType
  items: NavItem[]
}

export interface NavItem {
  to: string
  label: string
  icon?: ElementType
  alwaysShow?: boolean
  requiresPermission?: string
  requiresOffering?: string[]
  requiresFinanceMode?: string
}

export interface NavSearchEntry {
  kind: 'nav'
  id: string
  label: string
  /** Short hint shown under the label (e.g. "Settings → Online orders") */
  description?: string
  section: string
  sectionId: string
  to: string
  icon?: ElementType
  keywords: string[]
}

// ── Keyword hints per sidebar label ──────────────────────────────────────────

const KEYWORD_HINTS: Record<string, string[]> = {
  'Dashboard':                            ['home', 'analytics', 'overview', 'charts', 'summary'],
  'Business Profile':                     ['settings', 'config', 'profile', 'business', 'brand', 'logo', 'offering'],
  'Contact Information':                  ['settings', 'email', 'phone', 'contact', 'support'],
  'Addresses':                            ['settings', 'address', 'location', 'hq', 'headquarters'],
  'Tax & Compliance':                     ['settings', 'tax', 'gst', 'gstin', 'pan', 'compliance'],
  'Offline Business Hours':               ['settings', 'hours', 'opening hours', 'business hours'],
  'Online Orders':                        ['settings', 'order hours', 'order acceptance', 'online orders'],
  'About':                                ['settings', 'version', 'about', 'changelog', 'support'],
  'Settings':                             ['config', 'profile', 'tax', 'address', 'business', 'preferences', 'setup'],
  'POS':                                  ['point of sale', 'cashier', 'billing', 'till', 'retail', 'counter', 'cash register'],
  'P&L Statement':                        ['profit', 'loss', 'income', 'pnl', 'statement', 'profit loss'],
  'Balance Sheet':                        ['assets', 'liabilities', 'equity', 'bs', 'net worth'],
  'Cash Flow':                            ['money', 'liquidity', 'cash', 'cash statement'],
  'Journal Entries':                      ['ledger', 'debit', 'credit', 'posting', 'je', 'journal'],
  'Chart of Accounts':                    ['coa', 'accounts', 'gl', 'ledger accounts', 'account list'],
  'Trial Balance':                        ['tb', 'balance', 'closing balance'],
  'Invoice Templates':                    ['print', 'layout', 'design', 'invoice format', 'invoice style', 'receipt format'],
  'Quotation Templates':                  ['quotation', 'estimate', 'quote format', 'quote layout', 'quotation design'],
  'PO Templates':                         ['purchase order template', 'print po', 'po format', 'po layout'],
  'Inventory':                            ['stock', 'warehouse', 'quantity', 'stock levels', 'goods'],
  'Purchase Orders':                      ['po', 'supplier', 'buy', 'procurement', 'purchasing'],
  'Orders':                               ['sales', 'customer orders', 'transactions', 'sale orders'],
  'Invoices':                             ['billing', 'tax invoice', 'receipt', 'bill', 'invoice list'],
  'Credit / Debit Memos':                 ['memo', 'credit note', 'debit note', 'cn', 'dn', 'credit debit'],
  'Staff Access Control':                 ['users', 'staff', 'members', 'team', 'team members', 'employees', 'user management', 'permissions', 'acl', 'access control'],
  'Roles':                                ['permissions', 'access', 'acl', 'role management'],
  'Plans & Billing':                      ['subscription', 'upgrade', 'payment', 'pricing', 'plan', 'billing cycle'],
  'CRM Dashboard':                        ['customer relationship', 'crm', 'crm home'],
  'Knowledge Base':                       ['kb', 'articles', 'help', 'faq', 'documentation', 'guides'],
  'Campaigns':                            ['email campaign', 'marketing', 'newsletter', 'bulk email'],
  'Cost Centers':                         ['cc', 'cost centre', 'cost center', 'department cost', 'cost allocation'],
  'Fixed Assets':                         ['fa', 'depreciation', 'asset', 'fixed asset', 'asset register'],
  'Asset Register':                       ['asset register', 'fixed asset register', 'asset list', 'nbv'],
  'Depreciation Schedule':                ['depreciation schedule', 'depreciation report', 'accumulated depreciation'],
  'GL Reconciliation':                    ['gl reconciliation', 'subledger', 'fixed asset gl', 'variance'],
  'Tax Returns':                          ['gst', 'vat', 'tax', 'filing', 'tax return', 'return filing'],
  'Master Data — Customers & Suppliers':  ['customer', 'supplier', 'contacts', 'parties', 'vendors', 'client list'],
  'Storefront Dashboard':                 ['website dashboard', 'storefront overview', 'business front', 'live store', 'public store'],
  'Website Builder':                      ['web', 'site', 'page', 'cms', 'website', 'web builder'],
  'Business Front':                       ['storefront', 'store front', 'business front builder', 'customer store', 'public store', 'branding'],
  'Website Templates':                    ['preset', 'gallery', 'apply template', 'store theme', 'colors', 'fonts', 'hero', 'classic store', 'legacy template', 'homepage sections', 'product page layout', 'store template'],
  'Document Templates':                   ['doc', 'template', 'prescription', 'sop', 'challan', 'document', 'invoice template', 'quotation template', 'po template', 'purchase order template', 'billing', 'estimate'],
  'Blog Manager':                         ['blog', 'post', 'article', 'content', 'news'],
  'Notifications':                        ['alerts', 'bell', 'updates', 'notification list'],
  'Payroll':                              ['salary', 'pay', 'wages', 'payslip', 'payrun', 'compensation'],
  'Leave Requests':                       ['leave', 'vacation', 'time off', 'absence', 'holiday', 'pto'],
  'Attendance':                           ['clock in', 'presence', 'check in', 'attendance register'],
  'Recruitment':                          ['hire', 'job', 'applicant', 'candidate', 'job posting'],
  'Workspace Apps':                       ['apps', 'tools', 'workspace', 'utilities'],
  'Reports':                              ['analytics', 'data', 'report', 'export', 'reporting'],
  'Relationship Manager':                 ['rm', 'key account', 'manager', 'account manager'],
  'Finance Dashboard':                    ['finance', 'money', 'accounts', 'financial', 'finance home'],
  'Finance':                              ['money', 'accounts', 'financial'],
  'Accounts Receivable':                  ['ar', 'debtors', 'receivable', 'money owed to us'],
  'Accounts Payable':                     ['ap', 'creditors', 'payable', 'money we owe'],
  'Bank & Cash':                          ['bank', 'cash', 'reconciliation', 'bank account', 'bank balance'],
  'Budgets & Forecasts':                  ['budget', 'forecast', 'plan', 'financial plan'],
  'Audit Log':                            ['audit', 'history', 'log', 'activity log', 'change log'],
  'Coupons':                              ['discount', 'promo', 'voucher', 'coupon', 'offer code'],
  'Bookings':                             ['appointment', 'reservation', 'schedule', 'booking list'],
  'Quotations':                           ['quote', 'estimate', 'quotation', 'proposal', 'price quote'],
  'Subscriptions':                        ['recurring', 'subscription', 'renewal', 'recurring billing'],
  'Rentals':                              ['rent', 'hire', 'lease', 'rental'],
  'Production Orders':                    ['manufacturing', 'factory', 'bom', 'production', 'work order'],
  'Work Centers & Routing':                ['work center', 'work centre', 'routing', 'operations', 'machines', 'production routing'],
  'Material Requirements (MRP)':           ['mrp', 'bom', 'material requirement', 'stock check', 'reservation', 'component availability'],
  'Schedule':                             ['gantt', 'production schedule', 'production calendar', 'production timeline'],
  'Projects':                             ['project management', 'tasks', 'milestones', 'kanban', 'pm', 'delivery'],
  'Products':                             ['items', 'goods', 'inventory', 'product list', 'catalogue'],
  'Services':                             ['offerings', 'service list', 'services catalogue'],
  'Categories':                           ['category', 'tags', 'classification', 'product category'],
  'Contacts':                             ['people', 'crm contacts', 'contact list'],
  'Leads':                                ['prospect', 'opportunity', 'pipeline', 'lead'],
  'Pipeline':                             ['deal', 'funnel', 'sales pipeline', 'deal stages'],
  'Tickets':                              ['support', 'helpdesk', 'issue', 'support ticket'],
  'Inbox':                                ['messages', 'chat', 'communication', 'inbox messages'],
  'Reviews':                              ['feedback', 'rating', 'testimonial', 'review'],
  'Sales Area':                           ['sales area', 'division', 'distribution channel', 'delivery channel', 'sales organization', 'sd'],
  'Employees':                            ['staff', 'worker', 'hr', 'people', 'employee list'],
  'Designations':                         ['title', 'designation', 'position', 'job title'],
  'Departments':                          ['dept', 'division', 'team', 'department'],
  'Compliance':                           ['policy', 'legal', 'regulation', 'compliance policy'],
  'Offer Letters':                        ['offer', 'appointment letter', 'hr letter', 'job offer'],
  'Restaurant Floor':                     ['table', 'floor plan', 'seating', 'dine in', 'restaurant'],
  'Kitchen Board':                        ['kitchen', 'kds', 'cook', 'chef', 'food orders'],
  'Restaurant Tables':                    ['tables', 'restaurant', 'floor', 'seating'],
  'Dine-in Menu':                         ['qr menu', 'dine in menu', 'restaurant menu', 'table order', 'menu settings', 'curated menu', 'qr code menu', 'dine-in menu'],
  'Business Units':                       ['branch', 'outlet', 'location', 'store code', 'business unit', 'unit code'],
  'Approvals':                            ['approve', 'pending approval', 'finance approval'],
  'Posting Periods':                      ['period', 'close period', 'accounting period'],
  'GL Field Rules':                       ['gl', 'field rules', 'general ledger rules'],
  'GL Line Item Report':                  ['gl report', 'line items', 'ledger report'],
}

// ── Settings sub-section entries (deep links with ?section=) ────────────────

export const SETTINGS_SECTION_ENTRIES: NavSearchEntry[] = [
  {
    kind: 'nav', id: 'website-builder',
    label: 'Website Builder',
    description: 'Website Management → Build and publish your store website',
    section: 'Website Management', sectionId: 'website-management',
    to: '/websites',
    keywords: [
      'website', 'builder', 'storefront', 'publish', 'sections', 'pages', 'templates',
      'edit website', 'go live', 'business front', 'online store',
    ],
  },
  {
    kind: 'nav', id: 'seo-management',
    label: 'SEO Management',
    description: 'Website Management → Google titles, meta descriptions, and social previews',
    section: 'Website Management', sectionId: 'website-management',
    to: '/websites/seo',
    keywords: [
      'seo', 'search', 'google', 'meta title', 'meta description', 'og image',
      'social preview', 'keywords', 'search listing',
    ],
  },
  {
    kind: 'nav', id: 'settings-main',
    label: 'Settings',
    description: 'My Kit → Business Unit / Store settings',
    section: 'My Kit', sectionId: 'my-kit',
    to: '/settings',
    keywords: [
      'settings', 'configuration', 'business profile', 'contact', 'address', 'tax',
      'hours', 'online orders', 'about', 'vendor settings', 'store settings',
    ],
  },
  {
    kind: 'nav', id: 'settings-profile',
    label: 'Business Profile',
    description: 'Settings → Business Profile',
    section: 'My Kit', sectionId: 'my-kit',
    to: '/settings?section=profile',
    keywords: [
      'business name', 'brand', 'logo', 'banner', 'category', 'offering',
      'business type', 'industry', 'description', 'products services',
      'business info', 'company name', 'brand name',
    ],
  },
  {
    kind: 'nav', id: 'settings-contact',
    label: 'Contact Information',
    description: 'Settings → Contact',
    section: 'My Kit', sectionId: 'my-kit',
    to: '/settings?section=contact',
    keywords: [
      'email', 'phone', 'contact', 'support email', 'support phone',
      'primary email', 'primary phone', 'contact details',
    ],
  },
  {
    kind: 'nav', id: 'settings-address',
    label: 'Addresses',
    description: 'Settings → Addresses',
    section: 'My Kit', sectionId: 'my-kit',
    to: '/settings?section=address',
    keywords: [
      'address', 'location', 'street', 'city', 'state', 'pincode', 'zip',
      'headquarters', 'hq', 'office address', 'map', 'geo',
    ],
  },
  {
    kind: 'nav', id: 'settings-tax',
    label: 'Tax & Compliance',
    description: 'Settings → Tax',
    section: 'My Kit', sectionId: 'my-kit',
    to: '/settings?section=tax',
    keywords: [
      'tax', 'gst', 'gstin', 'pan', 'vat', 'tax rate', 'gst registration',
      'tax number', 'pan number', 'compliance', 'tax id', 'tds',
    ],
  },
  {
    kind: 'nav', id: 'settings-hours',
    label: 'Offline Business Hours',
    description: 'Settings → Offline Business Hours',
    section: 'My Kit', sectionId: 'my-kit',
    to: '/settings?section=hours-availability',
    keywords: [
      'hours', 'opening hours', 'business hours', 'open', 'close',
      'availability', 'when are you open', 'store timing', 'shop hours',
      'weekdays', 'weekend', 'monday friday', 'working hours', 'timing',
      'business front hours', 'open time', 'close time',
    ],
  },
  {
    kind: 'nav', id: 'settings-order-acceptance',
    label: 'Online Orders',
    description: 'Settings → Online Orders',
    section: 'My Kit', sectionId: 'my-kit',
    to: '/settings?section=order-acceptance',
    keywords: [
      'online orders', 'order hours', 'online hours', 'accept orders',
      'order acceptance', 'stop orders', 'enable orders', 'disable orders',
      'customers place orders', 'online store hours', 'ecommerce hours',
      'custom order hours', 'order timing', 'when can customers order',
      'same as offline', 'offline business hours', 'match opening hours',
      'business front orders', 'online ordering', 'order window', 'order time',
    ],
  },
  {
    kind: 'nav', id: 'settings-social',
    label: 'Social & Web Links',
    description: 'System Configuration → Social & Web Links',
    section: 'System Configuration', sectionId: 'system',
    to: '/system/social-links',
    keywords: [
      'social', 'facebook', 'instagram', 'twitter', 'linkedin', 'youtube',
      'website link', 'social media', 'web links', 'social links', 'whatsapp',
    ],
  },
  {
    kind: 'nav', id: 'settings-messages',
    label: 'Create Messages',
    description: 'System Configuration → Create Messages — BU notification recipients',
    section: 'System Configuration', sectionId: 'system',
    to: '/system/messages',
    keywords: [
      'create messages', 'message config', 'notification recipients', 'email recipients',
      'sms recipients', 'whatsapp recipients', 'customer notifications', 'business unit messages',
      'order notifications', 'notification preferences', 'message configuration',
    ],
  },
  {
    kind: 'nav', id: 'settings-display',
    label: 'Business Front Display',
    description: 'Website Management → Business Front display',
    section: 'Website Management', sectionId: 'website-management',
    to: '/system/storefront-display',
    keywords: [
      'display', 'business front', 'appearance', 'how store looks',
      'business front settings', 'shop appearance', 'product fields', 'service fields',
    ],
  },
  {
    kind: 'nav', id: 'settings-modules',
    label: 'Module Settings',
    description: 'System Configuration → Modules',
    section: 'System Configuration', sectionId: 'system',
    to: '/system/modules',
    keywords: [
      'modules', 'features', 'enable feature', 'disable feature',
      'finance mode', 'basic finance', 'advanced finance', 'module toggle',
      'hr module', 'enable hr', 'central hr', 'business unit hr', 'human resources',
    ],
  },
  {
    kind: 'nav', id: 'settings-models',
    label: 'Models',
    description: 'System Configuration → Database → Models',
    section: 'System Configuration', sectionId: 'system',
    to: '/system/models',
    keywords: ['models', 'schema', 'columns', 'api bindings', 'field mapping', 'database tables'],
  },
  {
    kind: 'nav', id: 'settings-table-data',
    label: 'Table Data',
    description: 'System Configuration → Database → Find by ID or text',
    section: 'System Configuration', sectionId: 'system',
    to: '/system/table-data',
    keywords: ['table data', 'find uuid', 'search database', 'lookup row', 'find value'],
  },
  {
    kind: 'nav', id: 'settings-browse-table',
    label: 'Browse Table',
    description: 'System Configuration → Database → Browse table rows',
    section: 'System Configuration', sectionId: 'system',
    to: '/system/browse-table',
    keywords: ['browse table', 'database browse', 'view rows', 'table records', 'sql tables'],
  },
  {
    kind: 'nav', id: 'settings-assets-images',
    label: 'Images',
    description: 'System Configuration → Gallery → Images',
    section: 'System Configuration', sectionId: 'system',
    to: '/system/assets/images',
    keywords: [
      'assets', 'images', 'stock photos', 'media library', 'image library',
      'business images', 'hero images', 'gallery', 'beauty', 'electronics',
      'jewelry', 'shop', 'store', 'supermarket', 'royalty free', 'stock images',
      'retail', 'book store', 'furniture', 'pet store', 'toy store', 'liquor',
      'optical', 'wholesale', 'distributor', 'ecommerce', 'department store',
      'food', 'hospitality', 'restaurant', 'catering', 'banquet', 'bar', 'pub',
      'resort', 'homestay', 'food truck', 'ice cream', 'juice', 'lounge', 'canteen',
    ],
  },
  {
    kind: 'nav', id: 'settings-about',
    label: 'About',
    description: 'Settings → About',
    section: 'My Kit', sectionId: 'my-kit',
    to: '/settings?section=about',
    keywords: [
      'version', 'about', 'changelog', 'release', 'build', 'app version',
      'update history', 'whats new',
    ],
  },
]

/** Extra routes reachable but not listed as nav items */
export const EXTRA_NAV_ENTRIES: NavSearchEntry[] = [
  { kind: 'nav', id: 'new-product',        label: 'New Product',              description: 'Inventory → Create product',            section: 'Inventory Management',   sectionId: 'inventory', to: '/products/new',              keywords: ['add', 'create', 'product', 'new product', 'add product'] },
  { kind: 'nav', id: 'new-service',        label: 'New Service',              description: 'Inventory → Create service',            section: 'Inventory Management',   sectionId: 'inventory', to: '/services/new',              keywords: ['add', 'create', 'service', 'new service', 'add service'] },
  { kind: 'nav', id: 'support-activity',   label: 'Support Activity Log',     description: 'Settings → Platform support log',       section: 'My Kit',                 sectionId: 'my-kit',    to: '/settings/support-activity', keywords: ['support', 'log', 'activity', 'platform', 'admin access'] },
  { kind: 'nav', id: 'notification-prefs', label: 'Notification Settings',    description: 'My Kit → Notification preferences',     section: 'My Kit',                 sectionId: 'my-kit',    to: '/notifications/settings',   keywords: ['notifications', 'preferences', 'alerts', 'sound', 'push', 'digest', 'quiet hours', 'do not disturb'] },
  { kind: 'nav', id: 'profile-page',       label: 'My Profile',               description: 'Account → Personal profile',            section: 'My Kit',                 sectionId: 'my-kit',    to: '/profile',                   keywords: ['profile', 'account', 'me', 'personal', 'my account', 'password', 'avatar'] },
  { kind: 'nav', id: 'business-units',     label: 'Business Units / Branches', description: 'Finance → Business units',              section: 'Finance Management',     sectionId: 'finance',   to: '/stores',                    keywords: ['business unit', 'branch', 'outlet', 'unit code', 'multi store', 'locations'] },
  { kind: 'nav', id: 'storefront-builder-legacy', label: 'Business Front Builder (legacy)', description: 'Redirects to Website Dashboard', section: 'Website Management', sectionId: 'website-management', to: '/business-front', keywords: ['storefront builder', 'business front builder', 'front builder'] },
  { kind: 'nav', id: 'master-data',        label: 'Customers & Suppliers',    description: 'Master Data → All parties',             section: 'Master Data Management', sectionId: 'master-data', to: '/master-data',             keywords: ['customer', 'supplier', 'parties', 'contacts', 'client', 'vendor', 'debtor', 'creditor'] },
  { kind: 'nav', id: 'projects-hub',       label: 'Projects',                 description: 'Sales → Project management',            section: 'Sales Management',       sectionId: 'sales',     to: '/projects',                  keywords: ['project', 'tasks', 'milestones', 'kanban', 'pm', 'delivery', 'project management'] },
]

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Flatten already-filtered visible nav sections into a search index.
 * Pass `visibleSections` (post-permission-filter) from DashboardLayout.
 */
export function buildNavIndex(sections: NavSection[]): NavSearchEntry[] {
  const entries: NavSearchEntry[] = []

  for (const section of sections) {
    for (const item of section.items) {
      const baseKeywords = KEYWORD_HINTS[item.label] ?? []
      // Derive additional keywords from the URL path segments
      const pathKeywords = item.to
        .split(/[/?&=]/)
        .filter(Boolean)
        .flatMap((seg) => seg.replace(/-/g, ' ').split(' '))
        .filter((k) => k.length > 1)

      entries.push({
        kind:        'nav',
        id:          `${section.id}:${item.to}`,
        label:       item.label,
        section:     section.title,
        sectionId:   section.id,
        to:          item.to,
        icon:        item.icon as ElementType | undefined,
        keywords:    [...baseKeywords, ...pathKeywords],
      })
    }
  }

  // Append settings deep-link entries
  for (const entry of SETTINGS_SECTION_ENTRIES) {
    const alreadyIndexed = entries.some((e) => e.id === entry.id)
    if (!alreadyIndexed) entries.push(entry)
  }

  // Append generic extras that don't appear in the sidebar
  for (const extra of EXTRA_NAV_ENTRIES) {
    const alreadyIndexed = entries.some((e) => e.id === extra.id)
    if (!alreadyIndexed) entries.push(extra)
  }

  return entries
}

// ── Matcher ───────────────────────────────────────────────────────────────────

/**
 * Token-based matching: every word in the query must appear somewhere in the
 * entry's label, section name, or keyword list. Order doesn't matter.
 *
 * Examples:
 *   "online hours"   → tokens ["online", "hours"] — both must match
 *   "gst tax"        → tokens ["gst", "tax"] — both must match
 *   "pnl report"     → matches P&L Statement ("pnl", "report"/"statement")
 */
export function matchesNavQuery(entry: NavSearchEntry, query: string): boolean {
  if (!query.trim()) return true

  const haystack = [
    entry.label,
    entry.section,
    entry.description ?? '',
    ...entry.keywords,
  ].join(' ').toLowerCase()

  // Split on whitespace, remove empty tokens, match every token
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return tokens.every((token) => haystack.includes(token))
}
