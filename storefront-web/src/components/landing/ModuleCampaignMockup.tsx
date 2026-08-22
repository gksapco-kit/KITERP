import type { CSSProperties } from 'react'
import type { CampaignMockupVariant } from './moduleCampaignContent'
import type { LandingModule } from './landingData'

type Props = { variant: CampaignMockupVariant; module: LandingModule }

function panelStyle(module: LandingModule): CSSProperties {
  return {
    ['--module-accent' as string]: module.accent.accent,
    ['--module-glow' as string]: module.accent.glow,
    ['--module-panel-tint' as string]: module.accent.panelTint,
  }
}

function MockBar({ title }: { title: string }) {
  return (
    <div className="kiterp-campaign-mock-bar">
      <span className="kiterp-campaign-mock-dot" />
      <span className="kiterp-campaign-mock-dot" />
      <span className="kiterp-campaign-mock-dot" />
      <span className="kiterp-campaign-mock-bar-title">{title}</span>
    </div>
  )
}

function DashboardMockup({ module }: { module: LandingModule }) {
  return (
    <div className="kiterp-campaign-mock kiterp-campaign-mock--dashboard">
      <MockBar title={`${module.label} dashboard`} />
      <div className="kiterp-campaign-mock-body">
        <div className="kiterp-campaign-mock-nav">
          {['Dashboard', 'Records', 'Reports', 'Settings'].map((item, i) => (
            <span key={item} className={i === 0 ? 'is-active' : undefined}>{item}</span>
          ))}
        </div>
        <div className="kiterp-campaign-mock-cards">
          {[
            { title: 'To validate', value: '3' },
            { title: 'In progress', value: '12' },
            { title: 'Completed', value: '48' },
          ].map((card) => (
            <div key={card.title} className="kiterp-campaign-mock-card">
              <p className="kiterp-campaign-mock-card-label">{card.title}</p>
              <p className="kiterp-campaign-mock-card-value">{card.value}</p>
              <div className="kiterp-campaign-mock-mini-chart" aria-hidden />
            </div>
          ))}
        </div>
        <div className="kiterp-campaign-mock-table">
          {[1, 2, 3].map((row) => (
            <div key={row} className="kiterp-campaign-mock-row">
              <span className="kiterp-campaign-mock-cell kiterp-campaign-mock-cell--wide" />
              <span className="kiterp-campaign-mock-cell" />
              <span className="kiterp-campaign-mock-cell kiterp-campaign-mock-cell--accent" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FormMockup({ module }: { module: LandingModule }) {
  return (
    <div className="kiterp-campaign-mock kiterp-campaign-mock--form">
      <MockBar title={`${module.label} record`} />
      <div className="kiterp-campaign-mock-body">
        <p className="kiterp-campaign-mock-record-id">DOC/2026/08/0001</p>
        <div className="kiterp-campaign-mock-fields">
          <div className="kiterp-campaign-mock-field"><span /><span /></div>
          <div className="kiterp-campaign-mock-field"><span /><span className="kiterp-campaign-mock-field-value--short" /></div>
        </div>
        <div className="kiterp-campaign-mock-tabs">
          <span className="is-active">Lines</span><span>Details</span><span>Notes</span>
        </div>
        <div className="kiterp-campaign-mock-table">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="kiterp-campaign-mock-row">
              <span className="kiterp-campaign-mock-cell kiterp-campaign-mock-cell--wide" />
              <span className="kiterp-campaign-mock-cell" />
              <span className="kiterp-campaign-mock-cell" />
              <span className="kiterp-campaign-mock-cell kiterp-campaign-mock-cell--accent" />
            </div>
          ))}
        </div>
        <div className="kiterp-campaign-mock-total"><span>Total</span><strong>₹34,500</strong></div>
      </div>
    </div>
  )
}

function SplitMockup({ module }: { module: LandingModule }) {
  return (
    <div className="kiterp-campaign-mock kiterp-campaign-mock--split">
      <MockBar title={`${module.label} — match view`} />
      <div className="kiterp-campaign-mock-split">
        <div className="kiterp-campaign-mock-split-pane">
          <p className="kiterp-campaign-mock-split-heading">List</p>
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className={`kiterp-campaign-mock-list-item${row === 2 ? ' is-selected' : ''}`}><span /><span /></div>
          ))}
        </div>
        <div className="kiterp-campaign-mock-split-pane kiterp-campaign-mock-split-pane--detail">
          <p className="kiterp-campaign-mock-split-heading">Detail</p>
          <div className="kiterp-campaign-mock-detail-actions">
            <span className="kiterp-campaign-mock-btn-primary">Validate</span>
            <span className="kiterp-campaign-mock-btn-secondary">Review</span>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="kiterp-campaign-mock-field"><span /><span /></div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PipelineMockup({ module }: { module: LandingModule }) {
  return (
    <div className="kiterp-campaign-mock kiterp-campaign-mock--pipeline">
      <MockBar title={`${module.label} pipeline`} />
      <div className="kiterp-campaign-mock-body">
        <div className="kiterp-campaign-mock-pipeline">
          {['New', 'Qualified', 'Proposal', 'Won'].map((stage, col) => (
            <div key={stage} className="kiterp-campaign-mock-pipeline-col">
              <p className="kiterp-campaign-mock-pipeline-stage">{stage}</p>
              {[1, 2].slice(0, col === 1 ? 2 : 1).map((card) => (
                <div key={card} className="kiterp-campaign-mock-pipeline-card"><span /><span /></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MobileMockup({ module }: { module: LandingModule }) {
  return (
    <div className="kiterp-campaign-mock-mobile-wrap">
      <div className="kiterp-campaign-mock-mobile">
        <div className="kiterp-campaign-mock-mobile-notch" aria-hidden />
        <div className="kiterp-campaign-mock-mobile-header"><span /><strong>{module.label}</strong><span /></div>
        <div className="kiterp-campaign-mock-mobile-body">
          <p className="kiterp-campaign-mock-record-id">Draft · today</p>
          {[1, 2, 3, 4].map((i) => (<div key={i} className="kiterp-campaign-mock-mobile-field"><span /><span /></div>))}
          <span className="kiterp-campaign-mock-btn-primary kiterp-campaign-mock-mobile-cta">Save</span>
        </div>
      </div>
    </div>
  )
}

export function ModuleCampaignMockup({ variant, module }: Props) {
  const content = (() => {
    switch (variant) {
      case 'form': return <FormMockup module={module} />
      case 'split': return <SplitMockup module={module} />
      case 'pipeline': return <PipelineMockup module={module} />
      case 'mobile': return <MobileMockup module={module} />
      default: return <DashboardMockup module={module} />
    }
  })()
  return <div className="kiterp-campaign-mockup-shell" style={panelStyle(module)}>{content}</div>
}
