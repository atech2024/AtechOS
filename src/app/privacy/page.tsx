import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal-document'

export const metadata: Metadata = {
  title: 'Avis de confidentialité | AtechOS',
  description: 'Projet d’avis de confidentialité AtechOS à valider avant publication.',
}

export default function PrivacyPage() {
  return <LegalDocument
    title="Privacy notice"
    introduction="This working draft identifies the current Supabase primary region from live project settings. Other hosting and data lifecycle details still need confirmation; this is not a final privacy policy."
    sections={[
      { title: 'Service operator', body: 'AtechOS is operated by Almando Tech, based in Montrouis, Haiti.' },
      { title: 'Support contact', body: 'For AtechOS service questions, contact almandotech@gmail.com or +509 4446 3728. For a student or family record request, contact the school administrator.' },
      { title: 'Information the platform may contain', body: 'Depending on the modules a school uses, AtechOS may contain staff and family account details, student identity, class and academic records, attendance, sanctions, and school payment records.' },
      { title: 'School access and use', body: 'School teams use these records to manage school workflows. The information available to each account depends on the school’s configured roles and access settings.' },
      { title: 'Invitation email delivery', body: 'When email delivery is configured, AtechOS calls Resend’s email API to send school invitations. The request includes the recipient email address, invitee name and role, and a private invitation link that expires after seven days. If email delivery is not configured or fails, AtechOS offers manual sharing of the link. Resend processing and retention terms and the Production email configuration still need confirmation for this draft.' },
      { title: 'Hosting and data lifecycle', body: 'The active AtechOS Supabase project reports US East (Ohio), us-east-2. Supabase documentation states that the selected region applies to the primary Postgres database, Auth, and Storage objects. Vercel project settings show AtechOS Functions running in Washington, D.C., USA (iad1). Vercel documents 3-day retention for its runtime logs; any connected log drain may have separate retention that still needs confirmation. This draft documents the invitation-email flow described above. Other email or notification flows, school-record retention periods and deletion procedures, AtechOS-specific processing across provider regions, security controls, and applicable data-processing arrangements still need confirmation before publication.' },
      { title: 'Children and families', body: 'Before publication, the school and service operator must confirm the rules and contact process for student information, family relationships, and requests made on behalf of a child.' },
    ]}
  />
}
