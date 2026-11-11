import CreateSchoolForm from './form'

export default function OnboardingPage() {
 const trialEnabled = process.env.VERCEL_ENV !== 'production' && process.env.SCHOOL_TRIAL_PREVIEW === 'true'
 return <CreateSchoolForm trialEnabled={trialEnabled}/>
}
