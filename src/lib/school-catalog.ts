// Editable starting catalogue; schools may add subjects for their own programme.
export const schoolSections = [
  { code: 'preschool', name: 'Préscolaire', grades: 'PS1 – PS3' },
  { code: 'primary', name: 'Primaire', grades: '1re – 6e AF' },
  { code: 'fundamental', name: 'Fondamentale · 3e cycle', grades: '7e – 9e AF' },
  { code: 'secondary', name: 'Secondaire', grades: 'NS1 – NS4' },
]
export function gradeSection(code: string | null | undefined) {
  if (/^PS[1-3]$/.test(code || '')) return 'preschool'
  if (/^AF[1-6]$/.test(code || '')) return 'primary'
  if (/^AF[7-9]$/.test(code || '')) return 'fundamental'
  if (/^NS[1-4]$/.test(code || '')) return 'secondary'
  return ''
}
export const subjectPresets = [
  ['FR', 'Français'], ['KR', 'Créole'], ['MATH', 'Mathématiques'],
  ['SOC', 'Sciences sociales'], ['HG', 'Histoire et géographie'],
  ['CIV', 'Éducation à la citoyenneté'], ['SCI', 'Sciences expérimentales'],
  ['ART', 'Éducation esthétique et artistique'], ['ETAP', 'Éducation à la technologie et aux activités productives'],
  ['EPS', 'Éducation physique et sportive'], ['ANG', 'Anglais'], ['ESP', 'Espagnol'],
  ['PHY', 'Physique'], ['CHIM', 'Chimie'], ['BIO', 'Biologie'], ['PHILO', 'Philosophie'],
]
export const periodPresets = [
  ['T1', '1er trimestre'], ['T2', '2e trimestre'], ['T3', '3e trimestre'],
  ['C1', '1er contrôle'], ['C2', '2e contrôle'], ['C3', '3e contrôle'], ['C4', '4e contrôle'],
]
