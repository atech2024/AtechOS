export function resolveStudentDossierId(requestedStudentId: string | null, availableStudentIds: readonly string[]): string {
  return requestedStudentId && availableStudentIds.includes(requestedStudentId) ? requestedStudentId : ''
}

export function buildStudentModuleHref(studentId: string, module: 'attendance' | 'grades' | 'sanctions'): string {
  return studentId ? `/dashboard/${module}?studentId=${encodeURIComponent(studentId)}` : `/dashboard/${module}`
}

export function buildStudentFamilyHref(studentId: string): string {
  return studentId
    ? `/dashboard/parents?studentId=${encodeURIComponent(studentId)}#family-relationships`
    : '/dashboard/parents#family-relationships'
}
