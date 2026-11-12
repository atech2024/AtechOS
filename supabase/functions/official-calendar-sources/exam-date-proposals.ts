export type ExamDateProposal = {
  date_text: string
  start_date: string | null
  end_date: string | null
  category: 'exam_period' | 'official_exam'
  context: string
  status: 'needs_review'
}

const months: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
}

function cleanText(html: string) {
  return html
    .replace(/<\/(?:p|li|div|tr|h[1-6])\s*>|<br\s*\/?>/gi, '. ')
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&eacute;|&#233;|&#xE9;/gi, 'é')
    .replace(/&egrave;|&#232;|&#xE8;/gi, 'è')
    .replace(/&agrave;|&#224;|&#xE0;/gi, 'à')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function concreteDate(day: string, month: string, schoolYear: string | null) {
  if (!schoolYear) return null
  const years = schoolYear.match(/^(20\d{2})\/(20\d{2})$/)
  const monthNumber = months[month.toLocaleLowerCase('fr')]
  if (!years || !monthNumber) return null
  // Haitian academic years normally begin around August/September; keep the year
  // unresolved for single-year articles instead of guessing from publication date.
  const year = Number(monthNumber >= 8 ? years[1] : years[2])
  const dayNumber = Number(day)
  const date = new Date(Date.UTC(year, monthNumber - 1, dayNumber))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthNumber - 1 || date.getUTCDate() !== dayNumber) return null
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
}

export function extractExamDateProposals(html: string, schoolYear: string | null): ExamDateProposal[] {
  const text = cleanText(html)
  const month = '(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)'
  const range = new RegExp(`(?:du\\s+)?(\\d{1,2})(?:er)?\\s+${month}\\s+(?:au|à|a|[-–—])\\s+(\\d{1,2})(?:er)?\\s+${month}|(?:du\\s+)?(\\d{1,2})(?:er)?\\s+(?:au|à|a|[-–—])\\s+(\\d{1,2})(?:er)?\\s+${month}`, 'gi')
  const proposals: ExamDateProposal[] = []
  for (const match of text.matchAll(range)) {
    const index = match.index ?? 0
    const previousBoundary = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('!', index), text.lastIndexOf('?', index), text.lastIndexOf(';', index))
    const nextBoundaries = ['.', '!', '?', ';'].map(mark => text.indexOf(mark, index + match[0].length)).filter(position => position >= 0)
    const context = text.slice(previousBoundary + 1, nextBoundaries.length ? Math.min(...nextBoundaries) : text.length).trim()
    if (!/(?:examen|examens|contrôle|controle|épreuve|epreuve|baccalauréat|baccalaureat|bac\b)/i.test(context)) continue
    const firstDay = match[1] || match[5]
    const firstMonth = match[2] || match[7]
    const lastDay = match[3] || match[6]
    const lastMonth = match[4] || match[7]
    const dateText = `${firstDay} ${firstMonth} au ${lastDay} ${lastMonth}`
    const official = /(?:officiel|officielle|état|etat|baccalauréat|baccalaureat|bac\b)/i.test(context)
    const proposal: ExamDateProposal = {
      date_text: dateText,
      start_date: concreteDate(firstDay, firstMonth, schoolYear),
      end_date: concreteDate(lastDay, lastMonth, schoolYear),
      category: official ? 'official_exam' : 'exam_period',
      context: context.slice(0, 320),
      status: 'needs_review',
    }
    if (!months[firstMonth.toLocaleLowerCase('fr')] || !months[lastMonth.toLocaleLowerCase('fr')]) continue
    if (!proposals.some(item => item.date_text.toLocaleLowerCase('fr') === proposal.date_text.toLocaleLowerCase('fr') && item.category === proposal.category)) proposals.push(proposal)
  }
  return proposals.slice(0, 30)
}
