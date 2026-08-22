import type { LucideIcon } from 'lucide-react'
import { Bot, Gauge, Smartphone, Sparkles, Zap } from 'lucide-react'
import { LANDING_MODULES, type LandingModule } from './landingData'

export type CampaignMockupVariant = 'dashboard' | 'form' | 'mobile' | 'split' | 'pipeline'

export type ModuleCampaignFeature = {
  id: string
  eyebrow?: string
  title: string
  accentPhrase?: string
  body: string
  bullets: string[]
  mockup: CampaignMockupVariant
  reverse?: boolean
}

export type ModuleCampaignContent = {
  headline: string
  highlightPhrase: string
  subhead: string
  proofLine: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  proofBadge?: { label: string; detail: string }
  benefits: { icon: LucideIcon; title: string; body: string }[]
  features: ModuleCampaignFeature[]
}

export const CAMPAIGN_BY_MODULE: Record<string, ModuleCampaignContent> = {
  'my-kit': {
    headline: 'Your command center for',
    highlightPhrase: 'every business day',
    subhead:
      'Start each morning with a unified workspace — notifications, inbox, relationship tools, and app shortcuts in one place.',
    proofLine: 'Built for owners and operators who need clarity before the first customer walks in.',
    seoTitle: 'My Kit — KIT ERP Workspace Dashboard',
    seoDescription:
      'Centralize notifications, inbox, relationship management, and workspace shortcuts in KIT ERP My Kit — your daily command center.',
    seoKeywords: 'erp dashboard, business workspace, notifications inbox, vendor portal, kiterp my kit',
    benefits: [
      {
        icon: Sparkles,
        title: 'One screen to start the day',
        body: 'See what needs attention — unread messages, pending approvals, and team updates — without jumping between modules.',
      },
      {
        icon: Zap,
        title: 'Instant access to every app',
        body: 'Pin the tools you use most and launch sales, inventory, finance, or HR from a single workspace grid.',
      },
      {
        icon: Bot,
        title: 'Smarter relationship follow-ups',
        body: 'Track customer and partner conversations so nothing slips through when your team is busy on the floor.',
      },
    ],
    features: [
      {
        id: 'unified-dashboard',
        eyebrow: 'Overview',
        title: 'A dashboard that reflects',
        accentPhrase: 'your real priorities',
        body: 'My Kit surfaces the metrics and tasks that matter to your role — from open orders to low-stock alerts.',
        bullets: [
          'Role-aware widgets you can rearrange',
          'Live counts for inbox, notifications, and tasks',
          'Quick links into every enabled module',
        ],
        mockup: 'dashboard',
      },
      {
        id: 'inbox-notifications',
        eyebrow: 'Communication',
        title: 'Never miss a message',
        accentPhrase: 'or approval',
        body: 'Centralize customer inquiries, internal notes, and system alerts so your team responds faster.',
        bullets: [
          'Unified inbox across channels',
          'Notification history with read/unread states',
          'One-click jump to the related record',
        ],
        mockup: 'split',
        reverse: true,
      },
      {
        id: 'workspace-shortcuts',
        eyebrow: 'Productivity',
        title: 'Launch any module',
        accentPhrase: 'in one click',
        body: 'Workspace Apps give every user a personalized launcher — ideal for multi-location teams with different needs.',
        bullets: [
          'Configurable app grid per user or role',
          'Mobile-friendly layout for on-the-go access',
          'Consistent navigation across the platform',
        ],
        mockup: 'mobile',
      },
    ],
  },

  'website-management': {
    headline: 'Launch a professional site',
    highlightPhrase: 'without a dev team',
    subhead:
      'Design your storefront, publish SEO-ready pages, manage your blog, and control how customers see your brand — all from KIT ERP.',
    proofLine: 'From template to live site in hours, not weeks.',
    seoTitle: 'Website Management — Business Website Builder | KIT ERP',
    seoDescription:
      'Build SEO-ready business websites, manage blogs, templates, and storefront display settings with KIT ERP Website Management.',
    seoKeywords: 'business website builder, erp storefront, seo management, blog manager, kiterp website',
    benefits: [
      {
        icon: Sparkles,
        title: 'Beautiful templates out of the box',
        body: 'Choose industry-ready layouts and customize colors, fonts, and sections to match your brand identity.',
      },
      {
        icon: Gauge,
        title: 'SEO built into every page',
        body: 'Manage meta titles, descriptions, and structured content so search engines and customers find you faster.',
      },
      {
        icon: Smartphone,
        title: 'Mobile-first by default',
        body: 'Every template renders cleanly on phones and tablets — where most of your customers browse and buy.',
      },
    ],
    features: [
      {
        id: 'website-builder',
        eyebrow: 'Builder',
        title: 'Drag, drop, and publish',
        accentPhrase: 'your business site',
        body: 'The Business Website Builder lets you compose pages from blocks — hero sections, product grids, contact forms, and more.',
        bullets: [
          'Visual editor with live preview',
          'Reusable sections across pages',
          'Publish updates without redeploying code',
        ],
        mockup: 'dashboard',
      },
      {
        id: 'seo-blog',
        eyebrow: 'Growth',
        title: 'Rank higher with',
        accentPhrase: 'integrated SEO',
        body: 'SEO Management and Blog Manager work together — optimize every URL and publish content that drives organic traffic.',
        bullets: [
          'Per-page SEO fields and previews',
          'Blog posts with categories and scheduling',
          'Search-friendly URLs and metadata',
        ],
        mockup: 'form',
        reverse: true,
      },
      {
        id: 'storefront-display',
        eyebrow: 'Brand',
        title: 'Control how customers',
        accentPhrase: 'experience your store',
        body: 'Business Front Display settings tune product presentation, banners, and layout — keeping your online shop on-brand.',
        bullets: [
          'Customize homepage and category layouts',
          'Highlight promotions and featured products',
          'Consistent branding across web and mobile',
        ],
        mockup: 'mobile',
      },
    ],
  },

  sales: {
    headline: 'Close deals from quote',
    highlightPhrase: 'to cash',
    subhead:
      'Manage quotations, orders, POS, bookings, projects, invoices, and marketplace listings — one connected sales engine.',
    proofLine: 'Trusted by retail, services, and B2B teams that need speed at the counter and in the back office.',
    seoTitle: 'Sales Management — Orders, POS & Invoicing | KIT ERP',
    seoDescription:
      'Run quotations, orders, POS, bookings, projects, invoices, subscriptions, and marketplace sales in KIT ERP Sales Management.',
    seoKeywords: 'sales erp, pos system, quotations orders, invoicing software, kiterp sales',
    benefits: [
      {
        icon: Zap,
        title: 'Quote-to-invoice in one flow',
        body: 'Convert quotations to orders and invoices without re-entering line items, prices, or customer details.',
      },
      {
        icon: Smartphone,
        title: 'POS that works on any device',
        body: 'Ring up sales at the counter, on the floor, or at events — with real-time inventory sync.',
      },
      {
        icon: Gauge,
        title: 'Reports that drive decisions',
        body: 'Sales Reports break down revenue by product, channel, region, and rep so you know what to push next.',
      },
    ],
    features: [
      {
        id: 'orders-quotations',
        eyebrow: 'Pipeline',
        title: 'Win more with',
        accentPhrase: 'structured quotations',
        body: 'Create professional quotes with tiered pricing, discounts, and expiry dates — then convert winners to orders instantly.',
        bullets: [
          'Quotation templates with approval workflows',
          'One-click conversion to sales orders',
          'Credit memos and coupon support',
        ],
        mockup: 'form',
      },
      {
        id: 'pos-bookings',
        eyebrow: 'Front line',
        title: 'Sell everywhere —',
        accentPhrase: 'counter to calendar',
        body: 'POS handles walk-in transactions while Bookings manages appointments, rentals, and scheduled services.',
        bullets: [
          'Fast checkout with barcode and search',
          'Booking slots with availability rules',
          'Subscriptions and pricing plans built in',
        ],
        mockup: 'mobile',
        reverse: true,
      },
      {
        id: 'marketplace-projects',
        eyebrow: 'Scale',
        title: 'Expand channels and',
        accentPhrase: 'manage complex deals',
        body: 'List on Marketplace, track Projects with milestones, and map Store Coverage so field teams know their territory.',
        bullets: [
          'Multi-channel order aggregation',
          'Project billing linked to time and materials',
          'Sales area and coverage mapping',
        ],
        mockup: 'pipeline',
      },
    ],
  },

  production: {
    headline: 'Plan, schedule, and deliver',
    highlightPhrase: 'on time',
    subhead:
      'Manufacturing orders, work centers, production schedules, and MRP — coordinated so shop floor and planning stay aligned.',
    proofLine: 'For make-to-order and make-to-stock teams that cannot afford idle machines.',
    seoTitle: 'Production Management — MRP & Manufacturing | KIT ERP',
    seoDescription:
      'Plan manufacturing orders, schedules, work centers, and material requirements with KIT ERP Production Management.',
    seoKeywords: 'manufacturing erp, mrp software, production scheduling, work centers, kiterp production',
    benefits: [
      {
        icon: Gauge,
        title: 'Real-time shop floor visibility',
        body: 'See which orders are queued, in progress, or delayed — and reallocate capacity before bottlenecks hit.',
      },
      {
        icon: Zap,
        title: 'MRP that prevents stockouts',
        body: 'Material Requirements Planning calculates what to buy and when, based on open orders and lead times.',
      },
      {
        icon: Bot,
        title: 'Smarter scheduling',
        body: 'Balance work centers and calendars so overtime is the exception, not the rule.',
      },
    ],
    features: [
      {
        id: 'manufacturing-orders',
        eyebrow: 'Execution',
        title: 'Run production with',
        accentPhrase: 'clear priorities',
        body: 'Manufacturing orders tie BOMs, routings, and quantities together — from release to completion.',
        bullets: [
          'Order status from draft to finished',
          'Component consumption tracking',
          'Scrap and yield adjustments',
        ],
        mockup: 'dashboard',
      },
      {
        id: 'schedule-work-centers',
        eyebrow: 'Capacity',
        title: 'Schedule around',
        accentPhrase: 'real constraints',
        body: 'Work Centers and the production Schedule show load by machine, shift, and skill — so planners act on facts.',
        bullets: [
          'Visual schedule by work center',
          'Drag-and-drop rescheduling',
          'Downtime and maintenance blocks',
        ],
        mockup: 'split',
        reverse: true,
      },
      {
        id: 'mrp-planning',
        eyebrow: 'Planning',
        title: 'Buy materials',
        accentPhrase: 'before you run out',
        body: 'MRP explodes BOMs, nets against inventory, and suggests purchase or production orders automatically.',
        bullets: [
          'Multi-level BOM explosion',
          'Lead time and safety stock rules',
          'Planned order proposals for procurement',
        ],
        mockup: 'form',
      },
    ],
  },

  restaurant: {
    headline: 'Run the floor and kitchen',
    highlightPhrase: 'in sync',
    subhead:
      'Table service, kitchen display, dine-in menus, reservations, and restaurant POS — built for busy dining rooms.',
    proofLine: 'Designed for restaurants that need speed during rush hour and accuracy after close.',
    seoTitle: 'Restaurant Module — POS, Kitchen & Reservations | KIT ERP',
    seoDescription:
      'Manage floor service, kitchen boards, dine-in menus, reservations, and restaurant POS with KIT ERP Restaurant.',
    seoKeywords: 'restaurant pos, kitchen display system, table reservations, dine-in menu, kiterp restaurant',
    benefits: [
      {
        icon: Zap,
        title: 'Faster table turns',
        body: 'Send orders straight to the kitchen and track table status so servers spend less time waiting.',
      },
      {
        icon: Smartphone,
        title: 'POS built for hospitality',
        body: 'Split bills, apply modifiers, and take payments at the table or counter — on tablet or terminal.',
      },
      {
        icon: Sparkles,
        title: 'Menus that sell',
        body: 'Update dine-in menus with daily specials and photos without reprinting or calling IT.',
      },
    ],
    features: [
      {
        id: 'floor-service',
        eyebrow: 'Front of house',
        title: 'Seat, serve, and settle',
        accentPhrase: 'without friction',
        body: 'The Restaurant app maps your floor plan, tracks open tables, and routes orders to the right station.',
        bullets: [
          'Table and section management',
          'Course firing and order notes',
          'Integrated payment at checkout',
        ],
        mockup: 'mobile',
      },
      {
        id: 'kitchen-board',
        eyebrow: 'Back of house',
        title: 'Kitchen Board keeps',
        accentPhrase: 'tickets moving',
        body: 'Chefs see orders by priority and prep station — with bump bars or touch to mark items done.',
        bullets: [
          'Color-coded ticket aging',
          'Station-based order routing',
          'Real-time sync with floor POS',
        ],
        mockup: 'dashboard',
        reverse: true,
      },
      {
        id: 'reservations-menu',
        eyebrow: 'Guest experience',
        title: 'Book ahead and',
        accentPhrase: 'delight at the table',
        body: 'Reservations manage party size and timing while Dine-in Menu showcases dishes with descriptions and pricing.',
        bullets: [
          'Online and in-house reservation slots',
          'Waitlist and no-show tracking',
          'Digital menu with modifiers and combos',
        ],
        mockup: 'split',
      },
    ],
  },

  commission: {
    headline: 'Pay partners fairly',
    highlightPhrase: 'and on time',
    subhead:
      'Define commission plans, track accruals, approve payouts, and report earnings — without spreadsheet chaos.',
    proofLine: 'For sales teams, agents, and affiliates who expect transparent, auditable compensation.',
    seoTitle: 'Commission Management — Plans & Payouts | KIT ERP',
    seoDescription:
      'Manage payees, commission plans, accruals, payouts, and reporting with KIT ERP Commission Management.',
    seoKeywords: 'commission software, sales commission plans, payout management, affiliate commissions, kiterp commission',
    benefits: [
      {
        icon: Gauge,
        title: 'Accurate accruals every period',
        body: 'Commission rules calculate automatically from closed orders — tiered rates, splits, and overrides included.',
      },
      {
        icon: Bot,
        title: 'Less manual reconciliation',
        body: 'Link payees to sales records so disputes are resolved with a clear audit trail, not guesswork.',
      },
      {
        icon: Zap,
        title: 'Faster payout cycles',
        body: 'Batch approve payouts and export to finance when the period closes — no last-minute spreadsheet fixes.',
      },
    ],
    features: [
      {
        id: 'commission-plans',
        eyebrow: 'Rules',
        title: 'Flexible plans for',
        accentPhrase: 'every payee type',
        body: 'Set percentage, flat, or tiered commission structures by product, channel, or sales territory.',
        bullets: [
          'Multiple active plans per payee group',
          'Effective dates and plan versioning',
          'Override rules for special deals',
        ],
        mockup: 'form',
      },
      {
        id: 'accruals-payouts',
        eyebrow: 'Settlement',
        title: 'From accrual to',
        accentPhrase: 'approved payout',
        body: 'Review accrued commissions by period, adjust exceptions, and release payouts with finance approval.',
        bullets: [
          'Period-based accrual runs',
          'Hold and release workflows',
          'Export-ready payout summaries',
        ],
        mockup: 'split',
        reverse: true,
      },
      {
        id: 'commission-reporting',
        eyebrow: 'Transparency',
        title: 'Reports payees',
        accentPhrase: 'actually trust',
        body: 'Commission reporting breaks down earnings by order, plan, and period — so reps see exactly how they were paid.',
        bullets: [
          'Payee self-service statements',
          'Manager roll-ups by team',
          'Variance vs. plan forecasts',
        ],
        mockup: 'dashboard',
      },
    ],
  },

  inventory: {
    headline: 'Know what you have',
    highlightPhrase: 'and where it is',
    subhead:
      'Products, services, stock levels, plants, storage locations, and purchasing — unified inventory control for growing businesses.',
    proofLine: 'Stop counting twice. Start selling with confidence.',
    seoTitle: 'Inventory Management — Stock & Warehousing | KIT ERP',
    seoDescription:
      'Manage products, services, stock, plants, storage locations, and purchase orders with KIT ERP Inventory Management.',
    seoKeywords: 'inventory management, stock control, warehouse erp, product catalog, kiterp inventory',
    benefits: [
      {
        icon: Gauge,
        title: 'Stock levels you can trust',
        body: 'Real-time quantities across plants and bins — updated by sales, production, and goods receipts.',
      },
      {
        icon: Zap,
        title: 'Faster product setup',
        body: 'Categories, variants, and catalog rules let you onboard new SKUs without rebuilding your structure.',
      },
      {
        icon: Smartphone,
        title: 'Count and adjust on mobile',
        body: 'Physical inventory counts and transfers work from the warehouse floor, not just the desktop.',
      },
    ],
    features: [
      {
        id: 'products-catalog',
        eyebrow: 'Catalog',
        title: 'Products and services',
        accentPhrase: 'in one catalog',
        body: 'Manage physical goods and billable services with pricing, units, and attributes — ready for sales and procurement.',
        bullets: [
          'Hierarchical categories and tags',
          'Multi-UOM and variant support',
          'Catalog publishing to storefront',
        ],
        mockup: 'form',
      },
      {
        id: 'stock-locations',
        eyebrow: 'Warehousing',
        title: 'Track stock by',
        accentPhrase: 'plant and bin',
        body: 'Plants and Storage Locations give multi-site businesses granular control over where inventory lives.',
        bullets: [
          'Bin-level quantity tracking',
          'Inter-location transfers',
          'Reorder points and alerts',
        ],
        mockup: 'split',
        reverse: true,
      },
      {
        id: 'inventory-purchasing',
        eyebrow: 'Replenishment',
        title: 'Replenish before',
        accentPhrase: 'you run dry',
        body: 'Purchase Orders linked to inventory suggestions keep bestsellers in stock without over-ordering.',
        bullets: [
          'Suggested PO lines from min/max rules',
          'Vendor lead time awareness',
          'Receipt posting updates stock instantly',
        ],
        mockup: 'dashboard',
      },
    ],
  },

  procurement: {
    headline: 'Source smarter and',
    highlightPhrase: 'pay accurately',
    subhead:
      'Purchase requisitions, sourcing, vendor invoices, goods receipt, and special procurement — end-to-end buying control.',
    proofLine: 'Give finance and operations one version of the truth on what was ordered, received, and invoiced.',
    seoTitle: 'Procurement Management — Purchasing & Vendors | KIT ERP',
    seoDescription:
      'Manage purchase requisitions, sourcing, vendor invoices, goods management, and special procurement in KIT ERP.',
    seoKeywords: 'procurement software, purchase requisitions, vendor invoices, goods receipt, kiterp procurement',
    benefits: [
      {
        icon: Bot,
        title: 'Guided buying workflows',
        body: 'Requisitions route through approvers with budgets and policies enforced before POs go out.',
      },
      {
        icon: Gauge,
        title: 'Three-way match built in',
        body: 'Compare PO, receipt, and vendor invoice so you pay only for what you ordered and received.',
      },
      {
        icon: Zap,
        title: 'Faster vendor onboarding',
        body: 'Sourcing Setup centralizes vendor terms, catalogs, and preferred suppliers for repeat buying.',
      },
    ],
    features: [
      {
        id: 'requisitions-approvals',
        eyebrow: 'Control',
        title: 'Requisitions with',
        accentPhrase: 'approval guardrails',
        body: 'Teams request what they need; managers approve against budget and policy before procurement acts.',
        bullets: [
          'Multi-step approval chains',
          'Budget checks at submission',
          'Convert approved reqs to POs',
        ],
        mockup: 'form',
      },
      {
        id: 'goods-vendor-invoices',
        eyebrow: 'Receiving',
        title: 'Receive goods and',
        accentPhrase: 'match invoices',
        body: 'Goods Management posts receipts to inventory while Vendor Invoices tie back to PO lines for clean AP.',
        bullets: [
          'Partial and full receipt handling',
          'Invoice variance highlighting',
          'Special procurement for non-stock buys',
        ],
        mockup: 'split',
        reverse: true,
      },
      {
        id: 'sourcing-setup',
        eyebrow: 'Strategy',
        title: 'Preferred vendors',
        accentPhrase: 'at your fingertips',
        body: 'Sourcing Setup stores contracts, lead times, and item mappings so buyers pick the right supplier every time.',
        bullets: [
          'Vendor scorecards and history',
          'Contract price lists',
          'Automated vendor selection rules',
        ],
        mockup: 'dashboard',
      },
    ],
  },

  finance: {
    headline: 'Accounting that keeps pace',
    highlightPhrase: 'with your business',
    subhead:
      'General ledger, AR/AP, banking, assets, budgets, tax returns, and financial reports — integrated with every transaction.',
    proofLine: 'From first invoice to year-end close, finance stays aligned with sales, inventory, and payroll.',
    seoTitle: 'Finance Management — Accounting & GST | KIT ERP',
    seoDescription:
      'Run accounting, AR/AP, bank reconciliation, fixed assets, budgets, tax returns, and reports with KIT ERP Finance — GST ready for India.',
    seoKeywords: 'erp accounting, gst software india, accounts payable receivable, financial reports, kiterp finance',
    proofBadge: {
      label: 'GST compliant',
      detail: 'Built for Indian tax & banking workflows',
    },
    benefits: [
      {
        icon: Gauge,
        title: 'Close periods with confidence',
        body: 'Chart of Accounts, journals, and period controls give auditors and CFOs a clear, consistent ledger.',
      },
      {
        icon: Zap,
        title: 'AR and AP on autopilot',
        body: 'Customer invoices and vendor bills flow from operations — reducing duplicate entry and payment delays.',
      },
      {
        icon: Bot,
        title: 'Tax-ready from day one',
        body: 'GST workflows, tax returns, and compliant document formats built for Indian regulatory requirements.',
      },
    ],
    features: [
      {
        id: 'ledger-ar-ap',
        eyebrow: 'Core accounting',
        title: 'One ledger for',
        accentPhrase: 'every business unit',
        body: 'Business Units and Chart of Accounts structure multi-entity books while AR and AP track who owes what.',
        bullets: [
          'Double-entry journals with audit trail',
          'Customer and vendor aging reports',
          'Multi-currency where needed',
        ],
        mockup: 'dashboard',
      },
      {
        id: 'bank-assets-budgets',
        eyebrow: 'Treasury',
        title: 'Bank, assets, and',
        accentPhrase: 'budgets aligned',
        body: 'Bank & Cash reconciliation, Fixed Assets depreciation, and Budgets & Forecasts keep cash and capex visible.',
        bullets: [
          'Bank statement import and matching',
          'Asset lifecycle from acquisition to disposal',
          'Budget vs. actual by cost center',
        ],
        mockup: 'form',
        reverse: true,
      },
      {
        id: 'tax-reports',
        eyebrow: 'Compliance',
        title: 'GST returns and',
        accentPhrase: 'management reports',
        body: 'Tax Returns prepare filing data while financial Reports give P&L, balance sheet, and custom views for leadership.',
        bullets: [
          'GST summary and return worksheets',
          'Standard and custom report builder',
          'Export to Excel and PDF',
        ],
        mockup: 'split',
      },
    ],
  },

  controlling: {
    headline: 'See true costs',
    highlightPhrase: 'before they surprise you',
    subhead:
      'Product costing, manufacturing orders, variance analysis, overhead allocation, and period-end closing — managerial accounting done right.',
    proofLine: 'Bridge operations and finance with costing that reflects how your plant actually runs.',
    seoTitle: 'Controlling Management — Cost Accounting | KIT ERP',
    seoDescription:
      'Plan product costs, analyze variances, allocate overhead, and close periods with KIT ERP Controlling Management.',
    seoKeywords: 'cost accounting, variance analysis, product costing erp, overhead allocation, kiterp controlling',
    benefits: [
      {
        icon: Gauge,
        title: 'Standard costs you can explain',
        body: 'Product Cost Planning rolls up materials, labor, and overhead so margins are predictable before you ship.',
      },
      {
        icon: Bot,
        title: 'Variance analysis that drives action',
        body: 'Compare planned vs. actual by order and cost center — and fix root causes, not symptoms.',
      },
      {
        icon: Zap,
        title: 'Smooth period-end close',
        body: 'WIP, allocations, and closing steps run in sequence so finance hits deadlines without fire drills.',
      },
    ],
    features: [
      {
        id: 'cost-centers-planning',
        eyebrow: 'Structure',
        title: 'Cost centers and',
        accentPhrase: 'product cost plans',
        body: 'Controlling Areas, Cost Centers, and Product Cost Planning define where money is spent and how products are priced.',
        bullets: [
          'Hierarchical cost center trees',
          'BOM and routing-based cost rolls',
          'Activity Types for machine and labor rates',
        ],
        mockup: 'dashboard',
      },
      {
        id: 'manufacturing-variance',
        eyebrow: 'Operations',
        title: 'Track orders and',
        accentPhrase: 'explain variances',
        body: 'Manufacturing Orders, Activity Confirmations, and Variance Analysis show where efficiency gains or losses occur.',
        bullets: [
          'Order-level actual cost accumulation',
          'Material, labor, and overhead variances',
          'WIP reports at period cut-off',
        ],
        mockup: 'split',
        reverse: true,
      },
      {
        id: 'allocations-period-end',
        eyebrow: 'Closing',
        title: 'Allocate overhead and',
        accentPhrase: 'close clean',
        body: 'Overhead Setup, Cost Allocations, and Period-End Closing distribute indirect costs and lock the CO books.',
        bullets: [
          'Step-down and assessment cycles',
          'Internal and project order tracking',
          'Finance integration for GL posting',
        ],
        mockup: 'form',
      },
    ],
  },

  'master-data': {
    headline: 'Clean data powers',
    highlightPhrase: 'every module',
    subhead:
      'Customers, suppliers, reviews, and shared reference data — maintained once and used everywhere across KIT ERP.',
    proofLine: 'Bad master data breaks reports. Good master data makes every team faster.',
    seoTitle: 'Master Data Management — Customers & Suppliers | KIT ERP',
    seoDescription:
      'Centralize customers, suppliers, reviews, and shared master data with KIT ERP Master Data Management.',
    seoKeywords: 'master data management, customer database erp, supplier records, review management, kiterp master data',
    benefits: [
      {
        icon: Sparkles,
        title: 'Single source of truth',
        body: 'One customer or supplier record feeds sales, finance, procurement, and CRM — no conflicting addresses or terms.',
      },
      {
        icon: Bot,
        title: 'Fewer duplicate entries',
        body: 'Validation and merge tools keep your directory clean as teams onboard accounts from different channels.',
      },
      {
        icon: Gauge,
        title: 'Reviews that build trust',
        body: 'Review Management collects and moderates customer feedback tied to products and services you sell.',
      },
    ],
    features: [
      {
        id: 'customers-suppliers',
        eyebrow: 'Directory',
        title: 'Customers and suppliers',
        accentPhrase: 'in one hub',
        body: 'Rich profiles with contacts, payment terms, tax IDs, and delivery preferences — shared across all modules.',
        bullets: [
          'Contact persons and communication history',
          'Credit limits and payment terms',
          'Address books for billing and shipping',
        ],
        mockup: 'form',
      },
      {
        id: 'data-quality',
        eyebrow: 'Governance',
        title: 'Govern data',
        accentPhrase: 'before it spreads',
        body: 'Master Data tools enforce required fields, formats, and uniqueness so downstream transactions stay reliable.',
        bullets: [
          'Duplicate detection suggestions',
          'Field-level validation rules',
          'Change history on key records',
        ],
        mockup: 'split',
        reverse: true,
      },
      {
        id: 'reviews-reputation',
        eyebrow: 'Reputation',
        title: 'Manage reviews',
        accentPhrase: 'that convert',
        body: 'Collect star ratings and comments, respond publicly, and surface top reviews on your storefront.',
        bullets: [
          'Moderation queue for new reviews',
          'Link reviews to products and orders',
          'Aggregate ratings for catalog display',
        ],
        mockup: 'mobile',
      },
    ],
  },

  crm: {
    headline: 'Turn relationships',
    highlightPhrase: 'into revenue',
    subhead:
      'Contacts, leads, pipeline, tickets, campaigns, and workflows — a CRM that shares data with sales and support.',
    proofLine: 'Your team sees the full customer story from first touch to renewal.',
    seoTitle: 'CRM Management — Pipeline & Customer Success | KIT ERP',
    seoDescription:
      'Manage contacts, leads, pipeline, tickets, campaigns, and CRM workflows with KIT ERP CRM Management.',
    seoKeywords: 'crm software, sales pipeline, lead management, support tickets, kiterp crm',
    benefits: [
      {
        icon: Zap,
        title: 'Pipeline visibility for everyone',
        body: 'See deal stage, value, and next steps so managers coach and reps focus on closable opportunities.',
      },
      {
        icon: Bot,
        title: 'Automated follow-ups',
        body: 'Workflows trigger tasks and emails when leads go cold or tickets breach SLA — no manual chasing.',
      },
      {
        icon: Smartphone,
        title: 'CRM in the field',
        body: 'Log calls, update deals, and resolve tickets from mobile — ideal for outside sales and service teams.',
      },
    ],
    features: [
      {
        id: 'leads-contacts',
        eyebrow: 'Acquisition',
        title: 'Capture leads and',
        accentPhrase: 'know your contacts',
        body: 'Leads enter from web forms, imports, or manual entry — then convert to contacts and opportunities in one flow.',
        bullets: [
          'Lead scoring and assignment rules',
          '360° contact timeline',
          'Import and deduplication tools',
        ],
        mockup: 'form',
      },
      {
        id: 'pipeline-deals',
        eyebrow: 'Sales',
        title: 'Pipeline boards that',
        accentPhrase: 'mirror reality',
        body: 'Drag deals across stages, forecast by close date, and link won opportunities to sales orders automatically.',
        bullets: [
          'Custom stages and win probabilities',
          'Weighted pipeline forecasts',
          'One-click order creation from won deals',
        ],
        mockup: 'pipeline',
        reverse: true,
      },
      {
        id: 'tickets-campaigns',
        eyebrow: 'Retention',
        title: 'Support tickets and',
        accentPhrase: 'targeted campaigns',
        body: 'Tickets track issues to resolution while Campaigns nurture segments with email and task-based outreach.',
        bullets: [
          'SLA timers and escalation paths',
          'Campaign lists from CRM segments',
          'CRM reports on conversion and CSAT',
        ],
        mockup: 'dashboard',
      },
    ],
  },

  hr: {
    headline: 'Your people operations',
    highlightPhrase: 'in one place',
    subhead:
      'Employees, attendance, leave, recruitment, payroll, and compliance — HR that connects to finance and operations.',
    proofLine: 'From hire to retire, employee data stays accurate and auditable.',
    seoTitle: 'HR Management — Payroll & Attendance | KIT ERP',
    seoDescription:
      'Manage employees, attendance, leave, recruitment, payroll, and HR compliance with KIT ERP HR Management.',
    seoKeywords: 'hr software, payroll erp, attendance tracking, leave management, recruitment, kiterp hr',
    benefits: [
      {
        icon: Gauge,
        title: 'Attendance you can audit',
        body: 'Clock-in/out, shifts, and leave balances feed payroll with fewer corrections at month-end.',
      },
      {
        icon: Zap,
        title: 'Payroll aligned with finance',
        body: 'Salary runs post to the general ledger automatically — statutory deductions and employer costs included.',
      },
      {
        icon: Bot,
        title: 'Hire faster with structured recruitment',
        body: 'Job posts, applicant tracking, and interview stages keep hiring managers and HR on the same page.',
      },
    ],
    features: [
      {
        id: 'employee-records',
        eyebrow: 'Core HR',
        title: 'Employee records',
        accentPhrase: 'that stay current',
        body: 'Central employee profiles hold job details, documents, bank info, and reporting lines for the whole org.',
        bullets: [
          'Org chart and department structure',
          'Document storage for contracts and IDs',
          'Role-based access to sensitive fields',
        ],
        mockup: 'form',
      },
      {
        id: 'attendance-leave',
        eyebrow: 'Time',
        title: 'Attendance and leave',
        accentPhrase: 'without spreadsheets',
        body: 'Track daily attendance, approve Leave Requests, and enforce policies before payroll cut-off.',
        bullets: [
          'Shift and roster management',
          'Leave accrual and approval workflows',
          'Overtime and exception reporting',
        ],
        mockup: 'mobile',
        reverse: true,
      },
      {
        id: 'recruitment-payroll',
        eyebrow: 'Lifecycle',
        title: 'Recruit, onboard, and',
        accentPhrase: 'pay on schedule',
        body: 'Recruitment pipelines feed new hires into Employee records; Payroll calculates earnings and posts to Finance.',
        bullets: [
          'Applicant stages and offer letters',
          'Onboarding checklists for day one',
          'Payroll runs with payslip generation',
        ],
        mockup: 'dashboard',
      },
    ],
  },

  system: {
    headline: 'Configure KIT ERP',
    highlightPhrase: 'your way',
    subhead:
      'Integrations, document templates, module settings, and access control — the foundation every other module builds on.',
    proofLine: 'Admins get powerful tools without needing custom code for every change.',
    seoTitle: 'System Configuration — Integrations & Settings | KIT ERP',
    seoDescription:
      'Configure integrations, document templates, module settings, and system access with KIT ERP System Configuration.',
    seoKeywords: 'erp configuration, system integrations, document templates, module settings, kiterp system',
    benefits: [
      {
        icon: Zap,
        title: 'Connect your stack',
        body: 'Integrations link payment gateways, shipping carriers, and accounting tools without brittle one-off scripts.',
      },
      {
        icon: Sparkles,
        title: 'Branded documents',
        body: 'Document Templates standardize invoices, POs, and quotes with your logo, terms, and legal footer.',
      },
      {
        icon: Gauge,
        title: 'Module settings with guardrails',
        body: 'Toggle features, defaults, and policies per module so rollout matches how your business actually operates.',
      },
    ],
    features: [
      {
        id: 'integrations',
        eyebrow: 'Connectivity',
        title: 'Integrations that',
        accentPhrase: 'stay maintained',
        body: 'Connect external services with credentials, webhooks, and sync logs — so IT knows when something needs attention.',
        bullets: [
          'Pre-built connectors for common services',
          'Webhook and API key management',
          'Sync status and error notifications',
        ],
        mockup: 'dashboard',
      },
      {
        id: 'document-templates',
        eyebrow: 'Documents',
        title: 'Templates for',
        accentPhrase: 'every transaction',
        body: 'Design PDF and email templates for invoices, delivery notes, and HR letters — versioned and assignable by module.',
        bullets: [
          'WYSIWYG layout editor',
          'Merge fields from live records',
          'Per-company and per-language variants',
        ],
        mockup: 'form',
        reverse: true,
      },
      {
        id: 'module-settings',
        eyebrow: 'Administration',
        title: 'Fine-tune modules',
        accentPhrase: 'without developers',
        body: 'Module Settings expose numbering sequences, approval rules, defaults, and feature flags admins control directly.',
        bullets: [
          'Centralized settings by module',
          'Role-based admin permissions',
          'Change logs for critical toggles',
        ],
        mockup: 'split',
      },
    ],
  },
}

/** All module ids with marketing campaign pages at `/apps/{id}`. */
export const CAMPAIGN_MODULE_IDS = Object.keys(CAMPAIGN_BY_MODULE)

export function moduleCampaignPath(moduleId: string): string {
  return `/apps/${moduleId}`
}

export function findLandingModule(moduleId: string): LandingModule | undefined {
  return LANDING_MODULES.find((m) => m.id === moduleId)
}

export function getModuleCampaignContent(moduleId: string): ModuleCampaignContent | undefined {
  return CAMPAIGN_BY_MODULE[moduleId]
}

export function isValidModuleId(moduleId: string): moduleId is keyof typeof CAMPAIGN_BY_MODULE {
  return moduleId in CAMPAIGN_BY_MODULE
}
