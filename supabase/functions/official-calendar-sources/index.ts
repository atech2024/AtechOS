import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractExamDateProposals, type ExamDateProposal } from './exam-date-proposals.ts'

const governmentPages = [
  { source: 'MENFP', url: 'https://www.menfp.gouv.ht/' },
  { source: 'Haitian Government', url: 'https://communication.gouv.ht/institution/education/' },
  { source: 'Haitian Government', url: 'https://communication.gouv.ht/ds/circulaire/' },
  { source: 'Haitian Government', url: 'https://communication.gouv.ht/communiques/' },
]
const educationArchives = [1, 2, 3].map(page => ({
  url: `https://www.haitilibre.com/cat-5-education-${page}.html`,
  host: 'HaitiLibre',
}))
const allowedGovernmentHosts = new Set(['menfp.gouv.ht', 'www.menfp.gouv.ht', 'communication.gouv.ht'])
const allowedMirrorHosts = new Set(['haitilibre.com', 'www.haitilibre.com', 'autodiscover.haitilibre.com'])
const userAgent = 'AtechOS school calendar source checker'

type Candidate = { url: string; source: string; label: string; school_year: string | null; kind: 'school_calendar' | 'exam_calendar'; suggested_dates?: ExamDateProposal[] }
type Article = { url: string; school_year: string | null; label: string; kind: 'school_calendar' | 'exam_calendar' }

function extractAnchors(html: string) {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)].map(match => ({
    href: match[2].replaceAll('&amp;', '&'),
    text: match[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }))
}

function discoverOfficialLinks(html: string, base: string, source: string): Candidate[] {
  const found = new Map<string, Candidate>()
  for (const anchor of extractAnchors(html)) try {
    const url = new URL(anchor.href, base)
    if (url.protocol !== 'https:' || !allowedGovernmentHosts.has(url.hostname)) continue
    const haystack = `${url.pathname} ${url.search} ${anchor.text}`
    if (!/(?:calendrier|calendar|calandriye)/i.test(haystack) || !/(?:20\d{2}(?:[_\-/ –—]?20\d{2})?|\.pdf(?:$|\?)|scolaire|examen|examens)/i.test(haystack)) continue
    const year = haystack.match(/(20\d{2})\s*[_\-/ –—]\s*(20\d{2})/)
    const label = anchor.text && /(?:calendrier|calendar|calandriye)/i.test(anchor.text)
      ? anchor.text
      : `${source} school calendar${year ? ` ${year[1]}–${year[2]}` : ''}`
    const kind = /(?:exam|examen|période|periode)/i.test(haystack) ? 'exam_calendar' : 'school_calendar'
    found.set(url.toString(), { url: url.toString(), source, label: label.slice(0, 240), school_year: year ? `${year[1]}/${year[2]}` : null, kind })
  } catch { /* ignore malformed or non-government links */ }
  return [...found.values()]
}

function discoverArticles(html: string, base: string): Article[] {
  const found = new Map<string, Article>()
  for (const anchor of extractAnchors(html)) try {
    const url = new URL(anchor.href, base)
    const title = `${url.pathname} ${anchor.text}`
    const year = title.match(/(20\d{2})[-_/](20\d{2})/i)
    const singleYear = title.match(/(20\d{2})/i)
    const exam = /(?:exam|examen|période|periode)/i.test(title)
    const kind = exam ? 'exam_calendar' : 'school_calendar'
    if (url.protocol !== 'https:' || !allowedMirrorHosts.has(url.hostname) || !/^\/article-\d+-/i.test(url.pathname) || (!exam && !/(?:calendrier|calendar|calandriye)[-_]scolaire/i.test(title)) || (!year && !exam)) continue
    const school_year = year ? `${year[1]}/${year[2]}` : null
    const label = kind === 'exam_calendar' ? `Examens et périodes${year ? ` ${year[1]}–${year[2]}` : singleYear ? ` ${singleYear[1]}` : ''} · source HaitiLibre à vérifier` : `Calendrier scolaire ${year![1]}–${year![2]} · copie publiée par HaitiLibre`
    found.set(url.toString(), { url: url.toString(), school_year, label, kind })
  } catch { /* ignore malformed links */ }
  return [...found.values()].sort((a, b) => Number(b.url.match(/article-(\d+)/)?.[1] || 0) - Number(a.url.match(/article-(\d+)/)?.[1] || 0))
}

function discoverPdf(html: string, base: string, schoolYear: string): Candidate | null {
  for (const anchor of extractAnchors(html)) try {
    const url = new URL(anchor.href, base)
    const year = url.pathname.match(/(?:calendrier[-_]scolaire|calendrier[-_]examens|examens?[-_]scolaires?)[-_](20\d{2})[-_](20\d{2})\.pdf$/i)
    if (url.protocol === 'https:' && allowedMirrorHosts.has(url.hostname) && year && `${year[1]}/${year[2]}` === schoolYear) {
      const kind = /(?:exam|examen|période|periode)/i.test(`${url.pathname} ${anchor.text}`) ? 'exam_calendar' : 'school_calendar'
      const label = kind === 'exam_calendar' ? `Examens et périodes ${year[1]}–${year[2]} · source HaitiLibre à vérifier` : `Calendrier scolaire ${year[1]}–${year[2]} · copie publiée par HaitiLibre`
      return { url: url.toString(), source: 'HaitiLibre', label, school_year: schoolYear, kind }
    }
  } catch { /* ignore malformed links */ }
  return null
}

async function fetchText(url: string, timeoutMs: number) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': userAgent } })
  if (!response.ok) throw new Error(`Source returned ${response.status}`)
  return response.text()
}

async function discoverMirrorPdf(): Promise<Candidate[]> {
  const archives = await Promise.all(educationArchives.map(async page => {
    try { return discoverArticles(await fetchText(page.url, 7000), page.url) } catch (error) {
      console.warn('Calendar education archive unavailable', page.url, error instanceof Error ? error.message : 'unknown error')
      return []
    }
  }))
  const articles = [...new Map(archives.flat().map(article => [article.url, article])).values()]
    .sort((a, b) => (b.school_year || '').localeCompare(a.school_year || '')).slice(0, 8)
  const documents = await Promise.all(articles.map(async article => {
    try {
      const html = await fetchText(article.url, 7000)
      const candidates: Candidate[] = []
      const text = html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
      const suggestedDates = extractExamDateProposals(html, article.school_year)
      if (suggestedDates.length) candidates.push({ url: article.url, source: 'HaitiLibre', label: `${article.label.replace(/ · .*$/, '')} · dat egzamen pwopoze pou verifikasyon`, school_year: article.school_year, kind: 'exam_calendar', suggested_dates: suggestedDates })
      if (/(?:examens officiels|calendrier des examens|horaires? des examens)/i.test(text)) candidates.push({ url: article.url, source: 'HaitiLibre', label: `${article.label.replace(/ · .*$/, '')} · examens officiels à vérifier`, school_year: article.school_year, kind: 'exam_calendar' })
      const pdf = article.school_year ? discoverPdf(html, article.url, article.school_year) : null
      if (pdf) {
        try {
          const response = await fetch(pdf.url, { signal: AbortSignal.timeout(9000), headers: { 'user-agent': userAgent } })
          if (response.ok && /application\/pdf/i.test(response.headers.get('content-type') || '')) {
            const bytes = new Uint8Array(await response.arrayBuffer())
            if (bytes.length >= 8 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') candidates.push(pdf)
          }
        } catch (error) {
          console.warn('Calendar mirror PDF unavailable', pdf.url, error instanceof Error ? error.message : 'unknown error')
        }
      }
      if (!candidates.length) candidates.push({ url: article.url, source: 'HaitiLibre', label: article.label, school_year: article.school_year, kind: article.kind })
      return candidates
    } catch (error) {
      console.warn('Calendar mirror document unavailable', article.url, error instanceof Error ? error.message : 'unknown error')
      return []
    }
  }))
  return documents.flat()
}

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!serviceRoleKey || token !== serviceRoleKey) return Response.json({ error: 'not_authorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({})) as { persist?: boolean }
    const officialPages = await Promise.all(governmentPages.map(async page => {
      try { return { links: discoverOfficialLinks(await fetchText(page.url, 3500), page.url, page.source), reachable: true } }
      catch (error) {
        console.warn('Official calendar page unavailable', page.url, error instanceof Error ? error.message : 'unknown error')
        return { links: [] as Candidate[], reachable: false }
      }
    }))
    const officialCandidates = officialPages.flatMap(page => page.links)
    const mirrorCandidates = await discoverMirrorPdf()
    const merged = new Map<string, Candidate>()
    for (const item of [...officialCandidates, ...mirrorCandidates]) {
      const previous = merged.get(item.url)
      merged.set(item.url, previous ? {
        ...previous,
        ...item,
        kind: item.kind === 'exam_calendar' || previous.kind === 'exam_calendar' ? 'exam_calendar' : 'school_calendar',
        suggested_dates: [...(previous.suggested_dates || []), ...(item.suggested_dates || [])].filter((proposal, index, all) => all.findIndex(other => other.date_text === proposal.date_text && other.category === proposal.category) === index),
      } : item)
    }
    const unique = [...merged.values()]
      .sort((a, b) => (b.school_year || '').localeCompare(a.school_year || ''))
    if (body.persist && unique.length) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const { error } = await supabase.from('official_calendar_sources').upsert(unique.map(item => ({ url: item.url, source: item.source, label: item.label, school_year: item.school_year, document_kind: item.kind, suggested_dates: item.suggested_dates || [], last_seen_at: new Date().toISOString() })), { onConflict: 'url' })
      if (error) throw error
    }
    return Response.json({
      checked_at: new Date().toISOString(),
      sources_checked: governmentPages.length + educationArchives.length,
      sources_reachable: officialPages.filter(page => page.reachable).length,
      documents_found: unique.length,
      latest_calendar: unique[0] || null,
      candidates: unique,
      warning: officialCandidates.length ? null : mirrorCandidates.length
        ? 'The Ministry and Government sites could not be reached. This is a HaitiLibre-hosted copy of a MENFP calendar; staff must verify it against the Ministry before approving any dates.'
        : 'The Ministry and Government sites could not be reached, and no verifiable calendar copy was found. No dates were inferred.',
    })
  } catch (error) {
    console.error('Calendar source discovery failed', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'official_source_check_failed' }, { status: 502 })
  }
})
