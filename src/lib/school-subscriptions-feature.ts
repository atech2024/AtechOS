export function isSchoolSubscriptionsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === 'production') {
    return env.SCHOOL_SUBSCRIPTIONS_ENABLED === 'true'
  }
  return env.SCHOOL_TRIAL_PREVIEW === 'true'
}
