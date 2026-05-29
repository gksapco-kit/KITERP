import { v4 as uuid } from 'uuid'

import { createBlockFromType } from './blockRegistry'

import { DEFAULT_PAGE_BACKGROUND } from './pageBackground'

import { stripSiteChrome, syncSiteChromeFromHome } from './siteChrome'

import type { Block, Page, SiteConfig } from '../types/builder'



export type LegalPageVariant = 'privacy' | 'terms'



function lastUpdatedLine(): string {

  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

}



export function defaultPrivacyPolicyHtml(businessName: string): string {

  const name = businessName.trim() || 'Our Company'

  return `

<h2>Introduction</h2>

<p>${name} ("we", "us", or "our") respects your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services.</p>



<h2>Information we collect</h2>

<p>We may collect information that you provide directly to us, including:</p>

<ul>

  <li>Name, email address, phone number, and billing or shipping details</li>

  <li>Account credentials if you create an account</li>

  <li>Messages you send through contact forms or customer support</li>

  <li>Order and transaction information when you make a purchase</li>

</ul>

<p>We may also automatically collect certain technical data such as IP address, browser type, device information, and pages visited.</p>



<h2>How we use your information</h2>

<p>We use the information we collect to:</p>

<ul>

  <li>Provide, operate, and improve our website and services</li>

  <li>Process orders, payments, and fulfill requests</li>

  <li>Respond to inquiries and provide customer support</li>

  <li>Send service-related communications and, with your consent, marketing messages</li>

  <li>Protect against fraud, abuse, and security incidents</li>

  <li>Comply with legal obligations</li>

</ul>



<h2>Sharing of information</h2>

<p>We do not sell your personal information. We may share information with trusted service providers who assist us in operating our website (such as hosting, payment processing, and email delivery), when required by law, or to protect our rights and users.</p>



<h2>Cookies and tracking</h2>

<p>We may use cookies and similar technologies to remember preferences, analyze traffic, and improve your experience. You can control cookies through your browser settings.</p>



<h2>Data retention and security</h2>

<p>We retain personal information only as long as necessary for the purposes described in this policy. We implement reasonable administrative, technical, and organizational measures to protect your data, though no method of transmission over the Internet is completely secure.</p>



<h2>Your rights</h2>

<p>Depending on your location, you may have the right to access, correct, delete, or restrict processing of your personal information, or to object to certain processing. To exercise these rights, contact us using the details on our Contact page.</p>



<h2>Children's privacy</h2>

<p>Our services are not directed to children under 13 (or the applicable age in your jurisdiction). We do not knowingly collect personal information from children.</p>



<h2>Changes to this policy</h2>

<p>We may update this Privacy Policy from time to time. The revised version will be posted on this page with an updated effective date.</p>



<h2>Contact us</h2>

<p>If you have questions about this Privacy Policy, please contact us through our <a href="#contact">Contact</a> page.</p>

`.trim()

}



export function defaultTermsAndConditionsHtml(businessName: string): string {

  const name = businessName.trim() || 'Our Company'

  return `

<h2>Agreement to terms</h2>

<p>By accessing or using the ${name} website and services, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our services.</p>



<h2>Use of our services</h2>

<p>You agree to use our website only for lawful purposes and in accordance with these terms. You must not:</p>

<ul>

  <li>Violate any applicable law or regulation</li>

  <li>Infringe the rights of others or submit false or misleading information</li>

  <li>Attempt to gain unauthorized access to our systems or interfere with site operation</li>

  <li>Use automated means to scrape or harvest data without our permission</li>

</ul>



<h2>Accounts and orders</h2>

<p>If you create an account, you are responsible for maintaining the confidentiality of your credentials and for all activity under your account. Product availability, pricing, and descriptions may change without notice. We reserve the right to refuse or cancel orders at our discretion.</p>



<h2>Payments and refunds</h2>

<p>Payment terms are displayed at checkout. Refunds and returns, if offered, are subject to the policy stated on our website or communicated at the time of purchase.</p>



<h2>Intellectual property</h2>

<p>All content on this website—including text, graphics, logos, images, and software—is owned by ${name} or its licensors and is protected by intellectual property laws. You may not copy, modify, or distribute our content without prior written consent.</p>



<h2>Disclaimer of warranties</h2>

<p>Our website and services are provided "as is" and "as available" without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, and non-infringement.</p>



<h2>Limitation of liability</h2>

<p>To the fullest extent permitted by law, ${name} shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our services.</p>



<h2>Indemnification</h2>

<p>You agree to indemnify and hold harmless ${name} and its affiliates from claims arising out of your use of the services or violation of these terms.</p>



<h2>Governing law</h2>

<p>These terms are governed by the laws applicable in our principal place of business, without regard to conflict-of-law principles.</p>



<h2>Changes</h2>

<p>We may revise these Terms and Conditions at any time. Continued use of the website after changes are posted constitutes acceptance of the updated terms.</p>



<h2>Contact</h2>

<p>For questions about these Terms and Conditions, please visit our <a href="#contact">Contact</a> page.</p>

`.trim()

}



function createLegalDocumentBlock(variant: LegalPageVariant, businessName: string): Block {

  const isPrivacy = variant === 'privacy'

  const block = createBlockFromType('legalDocument', uuid())

  block.props = {

    text: isPrivacy ? 'Privacy Policy' : 'Terms and Conditions',

    subtitle: lastUpdatedLine(),

    html: isPrivacy ? defaultPrivacyPolicyHtml(businessName) : defaultTermsAndConditionsHtml(businessName),

    legalVariant: variant,

  }

  block.styles = { padding: '0', margin: '0' }

  return block

}



/** Body blocks only — navbar/footer come from the home page via site chrome sync. */

export function createLegalPageBlocks(variant: LegalPageVariant, businessName: string): Block[] {

  return [createLegalDocumentBlock(variant, businessName)]

}



export function createLegalPage(

  variant: LegalPageVariant,

  businessName: string,

): Pick<Page, 'name' | 'slug' | 'kind' | 'blocks'> {

  return {

    name: variant === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions',

    slug: variant === 'privacy' ? 'privacy' : 'terms',

    kind: variant,

    blocks: createLegalPageBlocks(variant, businessName),

  }

}



function parseLastUpdated(paragraphText: string | undefined): string {

  if (!paragraphText) return lastUpdatedLine()

  const match = paragraphText.match(/Last updated:\s*(.+)/i)

  return match?.[1]?.trim() || lastUpdatedLine()

}



/** Upgrades legacy heading + paragraph + richText legal pages to the legalDocument block. */

export function upgradeLegalPageDesign(pages: Page[], businessName: string): Page[] {

  const name = businessName.trim() || 'Our Company'



  return pages.map((page) => {

    if (page.slug !== 'privacy' && page.slug !== 'terms') return page



    const body = stripSiteChrome(page.blocks)

    if (body.some((b) => b.type === 'legalDocument')) {

      return { ...page, blocks: body }

    }



    const variant: LegalPageVariant = page.slug === 'privacy' ? 'privacy' : 'terms'

    const rich = body.find((b) => b.type === 'richText')

    const heading = body.find((b) => b.type === 'heading')

    const updatedLine = body.find((b) => b.type === 'paragraph')



    const doc = createLegalDocumentBlock(variant, name)

    if (heading?.props.text) doc.props.text = String(heading.props.text)

    if (rich?.props.html) doc.props.html = String(rich.props.html)

    else if (rich?.props.text) doc.props.html = String(rich.props.text)

    doc.props.subtitle = parseLastUpdated(updatedLine?.props.text)



    return { ...page, blocks: [doc] }

  })

}



function legalPageInsertIndex(pages: Page[]): number {

  const contactIdx = pages.findIndex((p) => p.slug === 'contact' || p.kind === 'contact')

  return contactIdx >= 0 ? contactIdx + 1 : pages.length

}



function applySiteMigrations(pages: Page[], businessName: string): Page[] {

  let next = upgradeLegalPageDesign(pages, businessName)

  next = syncSiteChromeFromHome(next)

  return next

}



/** Adds Privacy Policy and Terms pages when missing (e.g. sites saved before legal pages existed). */

export function ensureLegalPages(

  pages: Page[],

  options: { businessName: string; siteConfig?: SiteConfig | null; navItems?: string[] },

): Page[] {

  const hasPrivacy = pages.some((p) => p.slug === 'privacy')

  const hasTerms = pages.some((p) => p.slug === 'terms')



  const businessName = options.businessName.trim() || 'Our Company'

  let result = [...pages]



  if (!hasPrivacy || !hasTerms) {

    let insertAt = legalPageInsertIndex(pages)



    if (!hasPrivacy) {

      result.splice(insertAt, 0, {

        id: uuid(),

        ...createLegalPage('privacy', businessName),

        background: { ...DEFAULT_PAGE_BACKGROUND },

      })

      insertAt += 1

    }



    if (!hasTerms) {

      result.splice(insertAt, 0, {

        id: uuid(),

        ...createLegalPage('terms', businessName),

        background: { ...DEFAULT_PAGE_BACKGROUND },

      })

    }

  }



  return applySiteMigrations(result, businessName)

}



/** Run chrome sync and legal page upgrades on any saved site. */

export function migrateSitePages(pages: Page[], businessName: string): Page[] {

  return applySiteMigrations(pages, businessName)

}


