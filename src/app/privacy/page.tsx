import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal-document'

export const metadata: Metadata = {
  title: 'Avis de confidentialité | AtechOS',
  description: 'Projet d’avis de confidentialité AtechOS à valider avant publication.',
}

export default function PrivacyPage() {
  return <LegalDocument
    title="Privacy notice"
    introduction="This working draft includes the operator and support details supplied by AtechOS. Hosting and data lifecycle details still need confirmation; this is not a final privacy policy."
    sections={[
      { title: 'Service operator', body: 'AtechOS is operated by Almando Tech, based in Montrouis, Haiti.' },
      { title: 'Support contact', body: 'For AtechOS service questions, contact almandotech@gmail.com or +509 4446 3728. For a student or family record request, contact the school administrator.' },
      { title: 'Information the platform may contain', body: 'Depending on the modules a school uses, AtechOS may contain staff and family account details, student identity, class and academic records, attendance, sanctions, and school payment records.' },
      { title: 'School access and use', body: 'School teams use these records to manage school workflows. The information available to each account depends on the school’s configured roles and access settings.' },
      { title: 'Hosting and data lifecycle', body: 'AtechOS has been described by its operator as hosted on secure servers. The hosting provider, server location, retention periods, deletion process, email providers, international transfers, security controls, and data-processing agreements have not yet been confirmed in the information available for this draft.' },
      { title: 'Children and families', body: 'Before publication, the school and service operator must confirm the rules and contact process for student information, family relationships, and requests made on behalf of a child.' },
    ]}
  />
}
