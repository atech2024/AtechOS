import CreateSchoolForm from './form'
import { isSchoolSubscriptionsEnabled } from '@/lib/school-subscriptions-feature'

export default function OnboardingPage() {
 const trialEnabled = isSchoolSubscriptionsEnabled()
 return <CreateSchoolForm trialEnabled={trialEnabled}/>
}
