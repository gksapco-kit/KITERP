/** Five-page InfocomX appointment letter, matching the company offer-letter stationery. */

import { INFOCOMX_LOGO_CLASS, INFOCOMX_LOGO_IMG_STYLE, INFOCOMX_LOGO_PATH } from '@/lib/infocomxBranding'

export const INFOCOMX_LAYOUT_ID = 'infocomx_letter'

export const INFOCOMX_TEMPLATE_NAME = 'InfocomX Offer Letter'

export const INFOCOMX_TEMPLATE_DESCRIPTION =
  'InfocomX appointment letter — letterhead, CTC table, and service agreement'

const RULE = '#1a56db'

function letterhead(pageNumber: number): string {
  return `<div data-section="header" style="padding:16px 28px 8px;color:#111;">
    <div style="margin-bottom:10px;">
      <img src="${INFOCOMX_LOGO_PATH}" alt="InfocomX" class="${INFOCOMX_LOGO_CLASS}" data-infocomx-logo="true" style="${INFOCOMX_LOGO_IMG_STYLE}" />
    </div>
    <div style="display:flex;justify-content:space-between;gap:18px;font-size:10.5px;line-height:1.35;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:800;font-size:11px;letter-spacing:.01em;">INFOCOMX TECHNOLOGIES PRIVATE LIMITED</div>
        <div>FT 203, KYR – BL-A, Roadno5, Bachupalli,</div>
        <div>Hyderabad, Telangana, India, 500090</div>
        <div>https://infocomx.com / https://infocomx.in</div>
      </div>
      <div style="flex:1;min-width:0;text-align:right;">
        <div style="font-weight:800;font-size:11px;letter-spacing:.01em;">INFOCOMX INC</div>
        <div># 16192 Coastal - Highway, County of Sussex,</div>
        <div>Lewes, Delaware, 19958, United States.</div>
        <div>Ph # +1 262 7099907, e-mail ID: email@infocomx.com</div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:4px;font-size:9px;color:#6b7280;">Page ${pageNumber}</div>
    <div style="margin-top:4px;border-bottom:2px solid ${RULE};"></div>
  </div>`
}

function pageShell(pageNumber: number, body: string): string {
  return `<div class="page-inner" data-offer-page="${pageNumber}" data-offer-custom="true" data-infocomx-letter="true" style="min-height:720px;display:flex;flex-direction:column;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;line-height:1.5;">
    ${letterhead(pageNumber)}
    <div class="body-content" style="flex:1;padding:12px 28px 28px;font-size:12px;line-height:1.5;">
      ${body}
    </div>
  </div>`
}

const PAGE_1 = `<p style="text-align:center;font-size:15px;font-weight:700;margin:4px 0 12px;">Offer Letter / Appointment</p>
<p style="margin:0 0 12px;">Date: {{offered_date}}</p>
<p style="margin:0 0 12px;">Mr/Mrs. <strong>{{candidate_name}}</strong>.<br/>{{candidate_address}}</p>
<p>Dear <strong>{{candidate_name}}</strong>,</p>
<p>Thank you for your interest in the employment with Infocomx Technologies Private Limited (Hereinafter referred to as “InfocomX”). Kindly confirm back to us with your acceptance.</p>
<p>In acceptance of the above terms and conditions, please return the duplicate copy of this letter duly signed in token of acceptance.</p>
<p>In order to make your onboarding it is mandatory for you to submit the below mentioned documents and details before/on your joining date:</p>
<ul style="margin:6px 0 10px 18px;padding:0;">
  <li>InfocomX offer letter</li>
  <li>Certificates &amp; Mark sheets from Class X to Highest Qualification held</li>
  <li>Appointment &amp; Relieving letters of previous employments</li>
  <li>Salary slips, Bank statement and Latest Form 16 or Provisional TDS certificate</li>
  <li>Passport Size photographs</li>
  <li>PAN Copy, Passport Copy and Copy of recently downloaded E-Aadhaar Card</li>
  <li>Active Mobile number, Alternate number and 2 references.</li>
</ul>
<p>Please note that you may be required to furnish additional documents on request. InfocomX or its clients also reserve the right to conduct the required background check to verify all the above-mentioned details as and when required.</p>
<p>Any enquiries that you may have in connection may be addressed to the Recruitment/HR team at HR@infocomx.com</p>
<p style="margin-top:16px;">Yours Sincerely,</p>
<p>For Infocomx Technologies Private Limited</p>
<p style="margin-top:36px;margin-bottom:0;"><strong>V Krishna</strong><br/>CEO.</p>`

const PAGE_2 = `<p>Dear <strong>{{candidate_name}}</strong>,</p>
<p>We are pleased to appoint you as a part of Team InfocomX and the relevant employment details are as provided below:</p>
<ul style="margin:6px 0 10px 18px;padding:0;">
  <li><strong>Designation:</strong> {{designation}}.</li>
  <li><strong>Base Location:</strong> {{store}}.</li>
  <li><strong>Your Annual CTC is {{offered_ctc}}.</strong></li>
</ul>
<table style="width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:11px;">
  <tr>
    <td style="border:1px solid #d1d5db;padding:5px 8px;font-weight:700;background:#f3f4f6;width:46%;">Salary / Cost To Company (CTC) Components</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;font-weight:700;background:#f3f4f6;width:27%;text-align:right;">Monthly</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;font-weight:700;background:#f3f4f6;width:27%;text-align:right;">Annualized</td>
  </tr>
  <tr>
    <td style="border:1px solid #d1d5db;padding:5px 8px;">Basic</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;">—</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;">—</td>
  </tr>
  <tr>
    <td style="border:1px solid #d1d5db;padding:5px 8px;">House Rent Allowance</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;">—</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;">—</td>
  </tr>
  <tr>
    <td style="border:1px solid #d1d5db;padding:5px 8px;">Conveyance</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;">—</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;">—</td>
  </tr>
  <tr>
    <td style="border:1px solid #d1d5db;padding:5px 8px;">Other Benefits</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;">—</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;">—</td>
  </tr>
  <tr>
    <td style="border:1px solid #d1d5db;padding:5px 8px;font-weight:700;">Gross Salary</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-weight:700;">—</td>
    <td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-weight:700;">{{offered_ctc}}</td>
  </tr>
</table>
<p style="font-size:11px;color:#4b5563;">Enter the monthly and annual breakup for this offer. Gross annual follows the CTC above.</p>
<ul style="margin:6px 0 10px 18px;padding:0;">
  <li>Your appointment will be effective on or before {{joining_date}} (DOJ) but not later than two weeks after DOJ, failing which InfocomX has the right to revisit the offer.</li>
  <li>InfocomX follows 45-hour week work schedule, and you will be expected to adhere to the rules pertaining to work timings as communicated to you from time to time. While you are deputed on an assignment, you are expected to adhere to client calendar.</li>
  <li>You will be on probation for a period of twelve (12) months from the date of your joining, there after the probation period may be either extended at the discretion of the management or will continue probation until the time confirmed in writing. During the probation time, your services can be terminated with thirty (30) days’ notice or wages in lieu of notice period by either side.</li>
  <li>You will be entitled to 18 leaves and applicable national holidays as declared by the Government of India. You will be eligible for Gratuity, ESI and the Provident Fund Programs as applicable and as per the relevant statutory requirements at that time once the company is eligible to file.</li>
  <li>Professional Tax and Income Tax deduction at source (TDS) will be deducted based on individual declarations made &amp; as per regulations prevailing from time to time.</li>
  <li>Your services are transferable to any other place or office of the Company or to any subsidiary or associate company or client place. Such Transfer/deputation will be in accordance with the policies adhered by Infocomx that are in effect at that time. Also, depending upon the requirements of Infocomx, you may be working in different work shifts which may include night shifts also.</li>
  <li>You will retire in the normal course from the services of InfocomX on attaining the age of superannuation that is on the day of your 60th birthday.</li>
  <li>Management reserves the right to re-structure salary components. Your signing this appointment letter confirms your acceptance of the terms and conditions of employment. As part of your employment as an employee of InfocomX, you will have to sign and abide by Service Agreement outlining the additional terms of your employment.</li>
</ul>`

const PAGE_3 = `<p style="font-size:14px;font-weight:700;margin:0 0 4px;">Service Agreement</p>
<p style="font-weight:700;margin:0 0 10px;">Terms and Conditions of Employment</p>
<p><strong>1. Employment:</strong> Effective as of the commencement date described below, the InfocomX employs you and you accept employment by the InfocomX upon the terms and conditions hereafter set forth.</p>
<p><strong>2. Term of Employment:</strong> Your employment under this agreement shall commence from the date of employment confirmation in writing. Either party shall give written notice of ninety (90) days of separation. This clause is not applicable in case of termination taking place as per the clause (8) service agreement of offer letter.</p>
<p><strong>3. Scope of Duties:</strong> During the Employment Period, you shall be employed in the capacity as stated in the Letter of Appointment as well as such other duties and responsibilities which may be assigned to you from time to time. You shall perform such service in good faith and comply with all rules, regulations and policies established or issued by InfocomX.</p>
<p><strong>4. Extent of Service:</strong> You shall devote your entire time, attention and energies to the business of InfocomX, and shall not during the Employment period engage in any other business activity which in the judgment of InfocomX conflicts with your duties hereunder.</p>
<p><strong>5. Compensation:</strong> In consideration of the services rendered by you hereunder, the InfocomX shall pay you an aggregate base salary as per the agreement in the letter of appointment. In addition to the Base Salary, you will be eligible for the benefits which InfocomX may from time to time make available generally to its employees in accordance with the terms of such benefit and welfare plans.</p>
<p><strong>6. Business Expenses:</strong> During the Employment period, the InfocomX shall reimburse you for all reasonable and necessary travel expenses in line with the business expense policy and other expenses incurred by you for or on behalf of InfocomX in the performance of your duties hereunder (hereinafter referred to as "Business Expenses") upon presentation by you to InfocomX of appropriate expense reports.</p>`

const PAGE_4 = `<p><strong>7. Death:</strong> In the event of unforeseen situation during the Employment Period, your employment hereunder shall be deemed to terminate as of the last day of the month during which the death occurs. In such situation, neither you nor the beneficiaries shall have any further rights or claims against the InfocomX, except the right to receive: The unpaid portion of the Base Salary, computed on a pro rata basis to the date of termination; Any earned, but unpaid commissions or other sales incentives; and Reimbursement for any unpaid business expenses.</p>
<p><strong>8. Termination for Cause:</strong> Upon furnishing of notice to you, InfocomX may terminate your employment for cause at any time during the Employment period by reason of (i) neglect of your duties hereunder, (ii) breach of or negligence with respect to your obligations under this Agreement, (iii) engaging in misconduct injurious to InfocomX, or (iv) your commission of an act constituting common law fraud or a felony. If your employment is terminated by InfocomX for cause as herein defined, your Base Salary and your eligibility for all other benefits provided by InfocomX shall cease as of your termination date, after which time InfocomX shall have no other further liability or obligation of any kind to the Employee under this Agreement, except you shall have the right to receive: The unpaid portion of the Base Salary, computed on a pro rata basis to the date of termination; Reimbursement for any unpaid business expenses; and Unused personal and vacation days to which you are entitled in accordance with InfocomX policy.</p>
<p><strong>9. Employee Acknowledgments:</strong> You recognize and acknowledge that in the course of your employment it will be necessary for you to acquire information which could include, in whole or in part, information concerning InfocomX sales, sales volume, sales methods, sales proposals, customers and prospective customers, suppliers and prospective suppliers, identity, practices and procedures of key purchasing and other personnel in the employ of customers and prospective customers and suppliers and prospective suppliers, amount or kind of customer's purchases from InfocomX, research reports, the InfocomX computer program, system documentation, special hardware, related software development, the InfocomX manuals, methods, ideas, improvements or other confidential or proprietary information belonging to InfocomX or relating to InfocomX affairs (collectively referred to herein as "Confidential Information") and that such information is the property of the InfocomX.</p>
<p>You further agree that the use, misappropriation or disclosure of the Confidential Information would constitute a breach of trust and could cause irreparable injury to InfocomX, and it is essential to the protection of the InfocomX good will and to the maintenance of InfocomX competitive position that the Confidential Information be kept secret and you agree not to disclose the Confidential Information to others or use the Confidential Information to your own advantage or the advantage of others.</p>
<p>You recognize and acknowledge that it is essential for the proper protection of the business of InfocomX that you be restrained from soliciting or inducing any employee of InfocomX to leave the employment of the Company or hiring or attempting to hire any employee of the Company.</p>
<p><strong>10. Non-Disclosure of Confidential Information:</strong> You shall hold and safeguard the Confidential Information in trust for InfocomX and its successors and shall not, without the prior written consent of InfocomX, misappropriate or disclose or make available to anyone for use outside the InfocomX organization at any time, either during your employment with InfocomX or subsequent to the termination of your employment with InfocomX for any reason, including, without limitation, termination by InfocomX for cause or without cause, any of the Confidential Information, whether or not developed by you, except as required in the performance of your duties to InfocomX.</p>`

const PAGE_5 = `<p><strong>11. Return of Materials:</strong> Upon the termination of your employment with InfocomX for any reason, including without limitation termination by InfocomX for cause or without cause, you shall promptly deliver to InfocomX all correspondence, manuals, orders, letters, notes, notebooks, reports, programs, proposals and any documents and copies concerning the InfocomX’s customers or concerning products or processes used by InfocomX and, without limiting the foregoing, will promptly deliver to InfocomX any and all other documents or material containing or constituting Confidential Information.</p>
<p><strong>12. Non-Solicitation of Customers and Suppliers:</strong> You shall not during the time of your employment with InfocomX, directly or indirectly, solicit the trade of, or do business with, any customer or prospective customer, or supplier or prospective supplier of InfocomX for any business purpose other than for the benefit of the InfocomX. You further acknowledge that, in consideration of the promises contained in the Agreement and to induce InfocomX to enter into this Agreement, you shall not for One (1) year following the termination of your employment with InfocomX, including, without limitation, termination by the InfocomX for cause or without cause, directly or indirectly, solicit the trade of, or do business with, any person or entity whatsoever who or which is or was a customer or supplier of InfocomX in any of the territory or territories assigned to you during the Employment Period, with respect to products of the same or similar kind as those presently or in the future distributed by InfocomX.</p>
<p><strong>13. Non-Solicitation of Employees:</strong> You shall not during your employment with InfocomX and for One (1) year following termination of your employment with InfocomX, including, without limitation, termination by the InfocomX for cause or without cause, directly or indirectly, solicit or induce, or attempt to solicit or induce, any employee, current or future, of the InfocomX to leave the InfocomX for any reason whatsoever, or hire any current or future employee of InfocomX.</p>
<p>All the terms of employment specified in this document can change, based on changes in the business scenario, from time to time. You will be informed about all such changes and will have to comply with the revised changes.</p>
<p style="margin-top:16px;">Agreed to and accepted with the express intent to be legally bound.</p>
<p style="margin-top:28px;">Employee Signature:</p>
<p style="margin-top:22px;">Employee Name: {{candidate_name}}</p>
<p>Date:</p>`

const PAGES = [PAGE_1, PAGE_2, PAGE_3, PAGE_4, PAGE_5]

export const INFOCOMX_OFFER_BODY = `<div data-offer-multi-page="true">${PAGES.map((body, i) => pageShell(i + 1, body)).join('')}</div>`

export function isInfocomxOfferHtml(html: string): boolean {
  return (html || '').includes('data-infocomx-letter="true"')
}

/** Blank continuation sheet that keeps the InfocomX letterhead. */
export function infocomxContinuationPage(pageNumber: number): string {
  return pageShell(pageNumber, '<p><br></p>')
}
