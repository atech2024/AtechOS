export type StaffDirectorySection = 'staff' | 'teachers' | 'parents' | 'students'
export type DirectoryRole = { role: string }

const staffRoles = new Set(['owner', 'school_admin', 'director', 'censeur', 'secretary', 'surveillant', 'accountant'])

export function getDirectorySections(access: readonly DirectoryRole[], isPreschoolCoordinator = false): StaffDirectorySection[] {
  const sections: StaffDirectorySection[] = []
  if (isPreschoolCoordinator || access.some(item => staffRoles.has(item.role))) sections.push('staff')
  if (access.some(item => item.role === 'teacher')) sections.push('teachers')
  if (access.some(item => item.role === 'parent')) sections.push('parents')
  if (access.some(item => item.role === 'student')) sections.push('students')
  return sections
}

export function getDisplayMemberRole(role: string, isSchoolOwner: boolean): string {
  return isSchoolOwner && role === 'school_admin' ? 'owner' : role
}
