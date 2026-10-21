export type StaffPagePresentation = {
  fullDirectory: boolean
  coordinatorAssignment: boolean
}

export function getStaffPagePresentation(
  owner: boolean,
  roles: readonly string[] = [],
): StaffPagePresentation {
  const roleSet = new Set(roles)
  const fullDirectory = owner || roleSet.has('school_admin')

  return {
    fullDirectory,
    coordinatorAssignment: fullDirectory || roleSet.has('director'),
  }
}

