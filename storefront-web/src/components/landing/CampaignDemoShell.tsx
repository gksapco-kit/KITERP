import type { ReactNode } from 'react'
import { Store } from 'lucide-react'
import type { CampaignDemoSceneId } from './campaignDemoScenes'
import { getSceneNavConfig, type CampaignDemoLayoutKind } from './campaignDemoScenes'
import type { LandingModule } from './landingData'

type Props = {
  sceneId: CampaignDemoSceneId
  module: LandingModule
  navLabel: string
  pageTitle?: string
  layoutKey: string
  activeMenuItem?: string
  onMenuItemChange?: (item: string) => void
  interactive?: boolean
  children: ReactNode
}

function SidebarNav({
  items,
  active,
  interactive,
  onSelect,
}: {
  items: string[]
  active: string
  interactive?: boolean
  onSelect?: (item: string) => void
}) {
  return (
    <aside className="kiterp-campaign-demo-sidebar">
      <div className="kiterp-demo-brand">
        <Store className="w-3.5 h-3.5" />
        <span>KIT ERP</span>
      </div>
      <nav className="kiterp-campaign-demo-nav">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            data-demo-nav={item}
            tabIndex={interactive ? 0 : -1}
            className={`kiterp-campaign-demo-nav-item${item === active ? ' is-active' : ''}`}
            onClick={() => onSelect?.(item)}
          >
            {item}
          </button>
        ))}
      </nav>
    </aside>
  )
}

function TopNavBar({
  items,
  active,
  interactive,
  onSelect,
}: {
  items: string[]
  active: string
  interactive?: boolean
  onSelect?: (item: string) => void
}) {
  return (
    <nav className="kiterp-campaign-demo-topnav" aria-label="Section navigation">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          data-demo-tab={item}
          tabIndex={interactive ? 0 : -1}
          className={`kiterp-campaign-demo-topnav-item${item === active ? ' is-active' : ''}`}
          onClick={() => onSelect?.(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  )
}

function FormDocToolbar({ title }: { title: string }) {
  return (
    <div className="kiterp-campaign-demo-formbar">
      <div className="kiterp-campaign-demo-formbar-title">{title}</div>
      <div className="kiterp-campaign-demo-formbar-actions">
        <span className="kiterp-campaign-demo-formbar-btn">Discard</span>
        <span className="kiterp-campaign-demo-formbar-btn kiterp-campaign-demo-formbar-btn--primary">
          Save
        </span>
      </div>
    </div>
  )
}

function MobileTabBar({
  items,
  active,
  interactive,
  onSelect,
}: {
  items: string[]
  active: string
  interactive?: boolean
  onSelect?: (item: string) => void
}) {
  return (
    <nav className="kiterp-campaign-demo-mobile-tabs" aria-label="Mobile navigation">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          data-demo-tab={item}
          tabIndex={interactive ? 0 : -1}
          className={`kiterp-campaign-demo-mobile-tab${item === active ? ' is-active' : ''}`}
          onClick={() => onSelect?.(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  )
}

function LayoutBody({
  layout,
  nav,
  pageTitle,
  activeMenuItem,
  interactive,
  onMenuItemChange,
  children,
}: {
  layout: CampaignDemoLayoutKind
  nav: ReturnType<typeof getSceneNavConfig>
  pageTitle?: string
  activeMenuItem?: string
  interactive?: boolean
  onMenuItemChange?: (item: string) => void
  children: ReactNode
}) {
  const menuActive = activeMenuItem ?? nav.active

  switch (layout) {
    case 'sidebar':
      return (
        <div className="kiterp-campaign-demo-layout kiterp-campaign-demo-layout--sidebar">
          {nav.sidebar ? (
            <SidebarNav
              items={nav.sidebar}
              active={menuActive}
              interactive={interactive}
              onSelect={onMenuItemChange}
            />
          ) : null}
          <div className="kiterp-campaign-demo-stage">
            {pageTitle || nav.pageTitle ? (
              <div className="kiterp-campaign-demo-pagehead">
                <h4>{pageTitle ?? nav.pageTitle}</h4>
              </div>
            ) : null}
            <div className="kiterp-campaign-demo-content kiterp-campaign-demo-content--fill">{children}</div>
          </div>
        </div>
      )

    case 'topnav':
      return (
        <div className="kiterp-campaign-demo-layout kiterp-campaign-demo-layout--topnav">
          {nav.topnav ? (
            <TopNavBar
              items={nav.topnav}
              active={menuActive}
              interactive={interactive}
              onSelect={onMenuItemChange}
            />
          ) : null}
          <div className="kiterp-campaign-demo-stage">
            {pageTitle || nav.pageTitle ? (
              <div className="kiterp-campaign-demo-pagehead">
                <h4>{pageTitle ?? nav.pageTitle}</h4>
              </div>
            ) : null}
            <div className="kiterp-campaign-demo-content kiterp-campaign-demo-content--fill">{children}</div>
          </div>
        </div>
      )

    case 'split':
      return (
        <div className="kiterp-campaign-demo-layout kiterp-campaign-demo-layout--split">
          {nav.sidebar ? (
            <SidebarNav
              items={nav.sidebar}
              active={menuActive}
              interactive={interactive}
              onSelect={onMenuItemChange}
            />
          ) : null}
          <div className="kiterp-campaign-demo-content kiterp-campaign-demo-content--split">{children}</div>
        </div>
      )

    case 'canvas':
      return (
        <div className="kiterp-campaign-demo-layout kiterp-campaign-demo-layout--canvas">
          {nav.topnav ? (
            <TopNavBar
              items={nav.topnav}
              active={menuActive}
              interactive={interactive}
              onSelect={onMenuItemChange}
            />
          ) : null}
          <div className="kiterp-campaign-demo-content kiterp-campaign-demo-content--canvas">{children}</div>
        </div>
      )

    case 'pos':
      return (
        <div className="kiterp-campaign-demo-layout kiterp-campaign-demo-layout--pos">
          {nav.topnav ? (
            <TopNavBar
              items={nav.topnav}
              active={menuActive}
              interactive={interactive}
              onSelect={onMenuItemChange}
            />
          ) : null}
          <div className="kiterp-campaign-demo-content kiterp-campaign-demo-content--pos">{children}</div>
        </div>
      )

    case 'kanban':
      return (
        <div className="kiterp-campaign-demo-layout kiterp-campaign-demo-layout--kanban">
          {nav.topnav ? (
            <TopNavBar
              items={nav.topnav}
              active={menuActive}
              interactive={interactive}
              onSelect={onMenuItemChange}
            />
          ) : null}
          <div className="kiterp-campaign-demo-content kiterp-campaign-demo-content--kanban">{children}</div>
        </div>
      )

    case 'form-doc':
      return (
        <div className="kiterp-campaign-demo-layout kiterp-campaign-demo-layout--form">
          <FormDocToolbar title={pageTitle ?? nav.pageTitle ?? 'Record'} />
          {nav.topnav ? (
            <TopNavBar
              items={nav.topnav}
              active={menuActive}
              interactive={interactive}
              onSelect={onMenuItemChange}
            />
          ) : null}
          <div className="kiterp-campaign-demo-content kiterp-campaign-demo-content--form">{children}</div>
        </div>
      )

    case 'mobile-shell':
      return (
        <div className="kiterp-campaign-demo-layout kiterp-campaign-demo-layout--mobile-shell">
          <div className="kiterp-campaign-demo-mobile-header">
            <span className="kiterp-campaign-demo-mobile-back" aria-hidden />
            <strong>{menuActive}</strong>
            <span className="kiterp-campaign-demo-mobile-menu" aria-hidden />
          </div>
          <div className="kiterp-campaign-demo-content kiterp-campaign-demo-content--mobile">{children}</div>
          {nav.topnav ? (
            <MobileTabBar
              items={nav.topnav}
              active={menuActive}
              interactive={interactive}
              onSelect={onMenuItemChange}
            />
          ) : null}
        </div>
      )

    default:
      return <div className="kiterp-campaign-demo-content">{children}</div>
  }
}

export function CampaignDemoShell({
  sceneId,
  module,
  navLabel,
  pageTitle,
  layoutKey,
  activeMenuItem,
  onMenuItemChange,
  interactive = true,
  children,
}: Props) {
  const nav = getSceneNavConfig(sceneId, module, navLabel)

  return (
    <div key={layoutKey} className={`kiterp-campaign-demo-main kiterp-campaign-demo-main--${nav.layout}`}>
      <LayoutBody
        layout={nav.layout}
        nav={nav}
        pageTitle={pageTitle}
        activeMenuItem={activeMenuItem}
        interactive={interactive}
        onMenuItemChange={onMenuItemChange}
      >
        {children}
      </LayoutBody>
    </div>
  )
}

export function getDemoUrlPath(
  sceneId: CampaignDemoSceneId,
  module: LandingModule,
  navLabel: string,
  activeTab?: string,
): string {
  const base = getSceneNavConfig(sceneId, module, navLabel).path
  if (!activeTab) return base
  const slug = activeTab.toLowerCase().replace(/\s+/g, '-')
  return base.replace(/\/[^/]+$/, `/${slug}`)
}

export function getDemoTopTabs(
  sceneId: CampaignDemoSceneId,
  module: LandingModule,
  navLabel: string,
): string[] {
  const nav = getSceneNavConfig(sceneId, module, navLabel)
  return nav.topnav ?? nav.sidebar ?? []
}

export function isBuilderTab(tab: string): boolean {
  const key = tab.toLowerCase()
  return key === 'blocks' || key === 'builder' || key === 'layout'
}
