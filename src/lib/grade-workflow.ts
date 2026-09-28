export const gradeStates: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', returned: 'Returned for correction',
  reviewed: 'Reviewed', published: 'Published',
}
export const gradeEvents: Record<string, string> = {
  created: 'Grade created', modified: 'Grade changed', submitted: 'Submitted',
  returned: 'Returned for correction', reviewed: 'Reviewed', published: 'Published',
  correction_requested: 'Correction requested', correction_returned: 'Correction returned',
  correction_reviewed: 'Correction approved', correction_published: 'Correction published',
}
export function gradeError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
  const messages: Record<string, string> = {
    grade_deadline_passed: 'The grade deadline has passed. Contact the school administration.',
    reason_required: 'Provide a reason of at least three characters.',
    grade_locked_pending_review: 'This grade is locked during review.',
    correction_already_pending: 'A correction is already awaiting review for this grade.',
    review_required: 'Only reviewed grades can be published.',
    selection_too_large: 'Select at most 1000 grades at a time using the filters.',
  }
  return messages[code] || 'Action refused. Reload the records and verify your access and selection.'
}
