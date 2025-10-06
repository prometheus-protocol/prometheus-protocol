import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Gold Verified Server Award Program - Terms and Conditions

**Last Updated:** October 5, 2025

---

## 1. Program Overview

The Gold Verified Server Award Program (the "Program") is designed to incentivize and reward developers for creating high-quality, secure, and well-documented MCP (Model Context Protocol) servers ("Servers") on the Internet Computer. The goal is to foster a robust ecosystem of trustworthy applications that can be used by AI agents and other services. A one-time Award of **$500 USD** is offered to each project that successfully meets the certification criteria.

---

## 2. Eligibility

To be eligible to participate in the Program and receive an Award, you (and your team, if applicable) must meet the following requirements:

*   **Age and Location:** You must be 18 years of age or older. The Program is open globally, except to individuals residing in countries sanctioned by the United States or where prohibited by local law.
*   **Deel Account Eligibility:** You must be able to legally register as an independent contractor and receive payments through the **Deel** platform. **It is your responsibility to verify that your country of residence is supported by Deel before applying to the Program.** Failure to successfully onboard with Deel will result in forfeiture of the Award.
*   **Approved Application:** You must have submitted a server idea through our official application form and received a "green light" or approval from the Prometheus Protocol team to begin development.
*   **Original Work:** The submitted Server must be your own original work. Projects that infringe on the intellectual property rights of others are ineligible.
*   **One Award Per Project:** A single project is only eligible for one Award, regardless of the number of team members.

---

## 3. Certification Requirements

To receive an Award, your submitted Server must achieve **Gold Verified** status, which requires:

1.  **Verified Build:** Cryptographic proof that the code running on-chain matches your public source code repository.
2.  **Audited App Info:** Your Server's metadata (name, description, capabilities) must be accurate and approved by our auditors.
3.  **Audited Tools:** All external APIs, services, or dependencies used by your Server must be documented and approved.
4.  **Audited Data Safety:** Your Server must meet our data privacy and security standards, including proper handling of user data and sensitive information.

The specific technical requirements for each audit stage are detailed in our [Developer Documentation](https://docs.prometheusprotocol.org).

---

## 4. Award Payout

*   **Amount and Platform:** The Award is a one-time payment of **$500 USD**. All payments will be processed exclusively through **Deel**, a third-party contractor payment platform. No other payment methods will be considered.
*   **Requirement for Payout:** To receive the Award, you must successfully create an account, complete the onboarding process, and pass any identity verification required by Deel. You must be able to receive payments as an independent contractor in compliance with Deel's terms of service and your local laws.
*   **Process:** Upon successful certification of your Server, we will invite you to our Deel platform to begin the onboarding and payment process.
*   **Taxes:** You will be required to complete all necessary tax documentation (such as an IRS W-9 or W-8BEN form) through the Deel platform. You remain solely responsible for any and all applicable national, state, and local taxes, as well as any reporting requirements associated with receiving the Award.

---

## 5. Application and Submission Process

1.  **Application:** Submit your Server idea through our official application form. Include a brief description of your Server's purpose, planned features, and development timeline.
2.  **Approval:** The Prometheus Protocol team will review your application and provide approval (a "green light") or feedback for revisions.
3.  **Development:** Build your Server according to our technical specifications and best practices.
4.  **Submission:** Once complete, submit your Server for certification through the Prometheus Protocol platform.
5.  **Audit:** Our team of auditors will review your Server against the Gold Verified criteria.
6.  **Certification:** Upon successful completion of all audit stages, your Server will be awarded the Gold Verified certificate.
7.  **Award:** You will be invited to complete the Deel onboarding process and receive your Award payment.

---

## 6. Intellectual Property

*   **Ownership:** You retain all intellectual property rights to your submitted Server.
*   **Open Source Requirement:** To be eligible for the Award, your Server must be released under an approved open-source license (such as MIT, Apache 2.0, or GPLv3).
*   **License to Use:** By participating in the Program, you grant Prometheus Protocol a non-exclusive, worldwide, royalty-free license to reference, display, and promote your Server as part of our platform and marketing materials.

---

## 7. Warranty and Liability

*   **No Warranty:** Prometheus Protocol makes no representations or warranties regarding the Award, the Program, or your ability to receive payment through Deel.
*   **Your Responsibility:** You are solely responsible for ensuring your Server's functionality, security, and compliance with all applicable laws and regulations.
*   **Limitation of Liability:** To the maximum extent permitted by law, Prometheus Protocol shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from your participation in the Program or use of your Server by third parties.
*   **Indemnification:** You agree to indemnify and hold harmless Prometheus Protocol, its affiliates, and its team members from any claims, damages, or expenses arising from your Server or your participation in the Program.

---

## 8. Program Changes and Termination

*   **Right to Modify:** Prometheus Protocol reserves the right to modify, suspend, or terminate the Program at any time, with or without notice.
*   **Discretion:** Prometheus Protocol reserves the right to reject any submission or revoke any certification at its sole discretion, particularly if a Server is found to violate these Terms or pose a security risk.
*   **No Obligation:** Prometheus Protocol has no obligation to continue the Program beyond the current funding period or to offer Awards indefinitely.

---

## 9. General Terms

*   **Entire Agreement:** These Terms constitute the entire agreement between you and Prometheus Protocol regarding the Program.
*   **Governing Law:** These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.
*   **Severability:** If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.
*   **No Assignment:** You may not assign or transfer your rights or obligations under these Terms without our prior written consent.

---

## 10. Contact Information

For questions about the Program or these Terms, please contact us at:

**Email:** [awards@prometheusprotocol.org](mailto:awards@prometheusprotocol.org)

---

**By submitting your Server for certification under this Program, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.**
`;

export function GoldVerifiedTermsPage() {
  return (
    <ContentPageLayout>
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => {
            if (props.href && props.href.startsWith('/')) {
              return <Link to={props.href} {...props} />;
            }
            return <a target="_blank" rel="noopener noreferrer" {...props} />;
          },
        }}>
        {markdownContent}
      </ReactMarkdown>
    </ContentPageLayout>
  );
}
