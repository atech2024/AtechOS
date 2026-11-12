import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal-document'

export const metadata: Metadata = {
  title: 'Avis de confidentialité | AtechOS',
  description: 'Projet d’avis de confidentialité AtechOS à valider avant publication.',
}

export default function PrivacyPage() {
  return <LegalDocument
    title="Privacy notice"
    introduction="This working draft identifies privacy details that still need confirmation. It is not a final privacy policy."
    sections={[
      { title: 'Information the platform may contain', body: 'Depending on the modules a school uses, AtechOS may contain staff and family account details, student identity, class and academic records, attendance, sanctions, and school payment records.' },
      { title: 'School access and use', body: 'School teams use these records to manage school workflows. The information available to each account depends on the school’s configured roles and access settings.' },
      { title: 'Requests about a school record', body: 'For a request to view or correct a student or family record, contact the school administrator. The school must confirm its formal contact channel and response process.' },
      { title: 'Details that need confirmation', body: 'The responsible organization, purposes, retention periods, deletion process, hosting and email providers, international transfers, security controls, and data-processing agreements must be confirmed from current operational records before publication.' },
      { title: 'Children and families', body: 'Before publication, the school and service operator must confirm the rules and contact process for student information, family relationships, and requests made on behalf of a child.' },
    ]}
  />
}
