import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

type Candidate = { url: string; source: string; label: string; school_year: string | null }
type Article = { url: string; school_year: string; label: string }

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
    if (!/(?:calendrier|calendar|calandriye)/i.test(haystack) || !/(?:20\d{2}(?:[_\-/ –—]?20\d{2})?|\.pdf(?:$|\?)|scolaire)/i.test(haystack)) continue
    const year = haystack.match(/(20\d{2})\s*[_\-/ –—]\s*(20\d{2})/)
    const label = anchor.text && /(?:calendrier|calendar|calandriye)/i.test(anchor.text)
      ? anchor.text
      : `${source} school calendar${year ? ` ${year[1]}–${year[2]}` : ''}`
    found.set(url.toString(), { url: url.toString(), source, label: label.slice(0, 240), school_year: year ? `${year[1]}/${year[2]}` : null })
  } catch { /* ignore malformed or non-government links */ }
  return [...found.values()]
}

function discoverArticles(html: string, base: string): Article[] {
  const found = new Map<string, Article>()
  for (const anchor of extractAnchors(html)) try {
    const url = new URL(anchor.href, base)
    const year = url.pathname.match(/calendrier[-_]scolaire[-_](20\d{2})[-_](20\d{2})/i)
    if (url.protocol !== 'https:' || !allowedMirrorHosts.has(url.hostname) || !/^\/article-\d+-/i.test(url.pathname) || !year) continue
    const school_year = `${year[1]}/${year[2]}`
    found.set(url.toString(), { url: url.toString(), school_year, label: `Calendrier scolaire ${year[1]}–${year[2]} · copie publiée par HaitiLibre` })
  } catch { /* ignore malformed links */ }
  return [...found.values()].sort((a, b) => b.school_year.localeCompare(a.school_year))
}

function discoverPdf(html: string, base: string, schoolYear: string): Candidate | null {
  for (const anchor of extractAnchors(html)) try {
    const url = new URL(anchor.href, base)
    const year = url.pathname.match(/calendrier[-_]scolaire[-_](20\d{2})[-_](20\d{2})\.pdf$/i)
    if (url.protocol === 'https:' && allowedMirrorHosts.has(url.hostname) && year && `${year[1]}/${year[2]}` === schoolYear) {
      return { url: url.toString(), source: 'HaitiLibre', label: `Calendrier scolaire ${year[1]}–${year[2]} · copie publiée par HaitiLibre`, school_year: schoolYear }
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
    .sort((a, b) => b.school_year.localeCompare(a.school_year)).slice(0, 5)
  const documents = await Promise.all(articles.map(async article => {
    try {
      const html = await fetchText(article.url, 7000)
      const pdf = discoverPdf(html, article.url, article.school_year)
      if (!pdf) return null
      const response = await fetch(pdf.url, { signal: AbortSignal.timeout(9000), headers: { 'user-agent': userAgent } })
      if (!response.ok || !/application\/pdf/i.test(response.headers.get('content-type') || '')) return null
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length < 8 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return null
      return pdf
    } catch (error) {
      console.warn('Calendar mirror document unavailable', article.url, error instanceof Error ? error.message : 'unknown error')
      return null
    }
  }))
  return documents.filter((item): item is Candidate => Boolean(item))
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
    let mirrorCandidates: Candidate[] = []
    if (!officialCandidates.length || officialPages.every(page => !page.reachable)) mirrorCandidates = await discoverMirrorPdf()
    const unique = [...new Map([...officialCandidates, ...mirrorCandidates].map(item => [item.url, item])).values()]
      .sort((a, b) => (b.school_year || '').localeCompare(a.school_year || ''))
    if (body.persist && unique.length) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const { error } = await supabase.from('official_calendar_sources').upsert(unique.map(item => ({ ...item, last_seen_at: new Date().toISOString() })), { onConflict: 'url' })
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
