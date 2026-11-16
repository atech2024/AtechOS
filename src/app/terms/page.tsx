import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal-document'

export const metadata: Metadata = {
  title: 'Conditions d’utilisation | AtechOS',
  description: 'Projet de conditions d’utilisation AtechOS à valider avant publication.',
}

export default function TermsPage() {
  return <LegalDocument
    title="Terms of use"
    introduction="This working draft includes the service operator and support details supplied by AtechOS. It is not a final legal agreement and requires review before publication."
    sections={[
      { title: 'Service operator', body: 'AtechOS is operated by Almando Tech, based in Montrouis, Haiti.' },
      { title: 'Support contact', body: 'For AtechOS service questions, contact almandotech@gmail.com or +509 4446 3728.' },
      { title: 'School workspace access', body: 'An account opens the school workspace and actions available to that account. School invitations and access are managed through the school setup.' },
      { title: 'Protecting an account', body: 'Keep your sign-in details private. If you suspect someone used your account, contact your school administrator.' },
      { title: 'Authorized use', body: 'Use AtechOS only for school tasks you are allowed to perform. Do not try to access records or accounts outside your assigned access.' },
      { title: 'School-specific rules', body: 'Each school configures its own academic, operational, and financial workflows. Confirm school rules with the school before acting.' },
      { title: 'Subscription payments', body: 'AtechOS currently states that subscription payments are non-refundable. This policy and any exceptions required by applicable law must be reviewed before these terms are published as final.' },
      { title: 'Required review before publication', body: 'Applicable law, fees, availability, liability, termination, and dispute process still need to be confirmed and reviewed before these terms can be published as final.' },
    ]}
  />
}
