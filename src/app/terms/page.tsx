import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal-document'

export const metadata: Metadata = {
  title: 'Conditions d’utilisation | AtechOS',
  description: 'Projet de conditions d’utilisation AtechOS à valider avant publication.',
}

export default function TermsPage() {
  return <LegalDocument
    title="Terms of use"
    introduction="This working draft describes basic access expectations. It is not ready to serve as a final legal agreement."
    sections={[
      { title: 'School workspace access', body: 'An account opens the school workspace and actions available to that account. School invitations and access are managed through the school setup.' },
      { title: 'Protecting an account', body: 'Keep your sign-in details private. If you suspect someone used your account, contact your school administrator.' },
      { title: 'Authorized use', body: 'Use AtechOS only for school tasks you are allowed to perform. Do not try to access records or accounts outside your assigned access.' },
      { title: 'School-specific rules', body: 'Each school configures its own academic, operational, and financial workflows. Confirm school rules with the school before acting.' },
      { title: 'Required review before publication', body: 'The service operator, applicable law, fees, availability, liability, termination, and dispute process still need to be confirmed and reviewed before these terms can be published as final.' },
    ]}
  />
}
