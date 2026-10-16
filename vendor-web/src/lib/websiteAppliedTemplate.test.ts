import { describe, expect, it } from 'vitest'
import {
  coverageLiveTemplateLabel,
  displayHost,
  formatBusinessFrontTemplateOptionLabel,
  resolveBusinessFrontOptionIdentity,
  type BusinessFrontOptionSite,
} from '@/lib/websiteAppliedTemplate'

const sriSaiSite: BusinessFrontOptionSite = {
  id: 'site-1',
  name: 'Sri Sai Home Foods Website',
  is_published: true,
  applied_template_id: 'tpl-sri-sai',
  applied_template_name: 'Sri Sai Home Foods Website',
  storefront_assigned: true,
}

describe('resolveBusinessFrontOptionIdentity', () => {
  it('labels the live copy with the business and its domain, not the source kit', () => {
    const identity = resolveBusinessFrontOptionIdentity({
      optionId: 'site-1',
      fallbackName: 'Sri Sai Home Foods Website',
      sites: [sriSaiSite],
      businessName: 'Sri Dharma Sastra Home Foods',
      externalDomain: 'https://www.sridharmasastrahomefoods.com/',
      active: true,
    })
    expect(identity).toEqual({
      name: 'Sri Dharma Sastra Home Foods',
      domain: 'www.sridharmasastrahomefoods.com',
    })
    expect(formatBusinessFrontTemplateOptionLabel({
      name: identity.name,
      domain: identity.domain,
      assignedTo: ['1000'],
      active: true,
    })).toBe('Active · Sri Dharma Sastra Home Foods · www.sridharmasastrahomefoods.com')
  })

  it('keeps a renamed website name and prefers that site domain', () => {
    const identity = resolveBusinessFrontOptionIdentity({
      optionId: 'site-1',
      fallbackName: 'Sri Sai Home Foods Website',
      sites: [{
        ...sriSaiSite,
        name: 'Sri Dharma Sastra Home Foods',
        custom_domain: 'shop.example.com',
      }],
      businessName: 'Other Name',
      externalDomain: 'www.sridharmasastrahomefoods.com',
      active: true,
    })
    expect(identity.name).toBe('Sri Dharma Sastra Home Foods')
    expect(identity.domain).toBe('shop.example.com')
  })

  it('leaves an unused kit under its own name', () => {
    const identity = resolveBusinessFrontOptionIdentity({
      optionId: 'tpl-sri-sai',
      fallbackName: 'Sri Sai Home Foods Website',
      sites: [sriSaiSite],
      businessName: 'Sri Dharma Sastra Home Foods',
      externalDomain: 'www.sridharmasastrahomefoods.com',
      active: false,
    })
    expect(identity.name).toBe('Sri Sai Home Foods Website')
    expect(identity.domain).toBeNull()
    expect(formatBusinessFrontTemplateOptionLabel({
      name: identity.name,
      domain: identity.domain,
      active: false,
    })).toBe('Sri Sai Home Foods Website')
  })

  it('uses the business name when the public name is still the copied kit', () => {
    const identity = resolveBusinessFrontOptionIdentity({
      optionId: 'site-1',
      fallbackName: 'Sri Sai Home Foods Website',
      sites: [sriSaiSite],
      businessName: 'Sri Sai Home Foods Website',
      otherBusinessNames: ['Sri Dharma Sastra Home Foods'],
      externalDomain: 'www.sridharmasastrahomefoods.com',
      active: true,
    })
    expect(identity.name).toBe('Sri Dharma Sastra Home Foods')
  })

  it('uses the applied site when the assigned id is the kit id', () => {
    const identity = resolveBusinessFrontOptionIdentity({
      optionId: 'tpl-sri-sai',
      fallbackName: 'Sri Sai Home Foods Website',
      sites: [sriSaiSite],
      businessName: 'Sri Dharma Sastra Home Foods',
      externalDomain: 'www.sridharmasastrahomefoods.com',
      active: true,
    })
    expect(identity.name).toBe('Sri Dharma Sastra Home Foods')
    expect(identity.domain).toBe('www.sridharmasastrahomefoods.com')
  })
})

describe('formatBusinessFrontTemplateOptionLabel', () => {
  it('lists every assigned unit when more than one is live on that template', () => {
    expect(formatBusinessFrontTemplateOptionLabel({
      name: 'Sri Dharma Sastra Home Foods',
      domain: 'www.sridharmasastrahomefoods.com',
      assignedTo: ['1000', '1001'],
      active: true,
    })).toBe('Active · Sri Dharma Sastra Home Foods · www.sridharmasastrahomefoods.com · 1000, 1001')
  })
})

describe('coverageLiveTemplateLabel', () => {
  it('replaces the copied kit with the live domain', () => {
    expect(coverageLiveTemplateLabel({
      templateName: 'Sri Sai Home Foods Website',
      templateId: 'site-1',
      sites: [sriSaiSite],
      storeName: 'SRI DHARMA SASTRA HOME FOODS',
      businessNames: ['Sri Dharma Sastra Home Foods'],
      externalDomain: 'https://www.sridharmasastrahomefoods.com/',
    })).toBe('www.sridharmasastrahomefoods.com')
  })

  it('keeps a website name that is no longer the kit', () => {
    expect(coverageLiveTemplateLabel({
      templateName: 'Sri Dharma Sastra Home Foods',
      templateId: 'site-1',
      sites: [{ ...sriSaiSite, name: 'Sri Dharma Sastra Home Foods' }],
      storeName: 'SRI DHARMA SASTRA HOME FOODS',
      externalDomain: 'www.sridharmasastrahomefoods.com',
    })).toBe('Sri Dharma Sastra Home Foods')
  })
})
describe('displayHost', () => {
  it('returns the hostname from a full URL', () => {
    expect(displayHost('https://www.sridharmasastrahomefoods.com/products')).toBe('www.sridharmasastrahomefoods.com')
    expect(displayHost('')).toBeNull()
  })
})
