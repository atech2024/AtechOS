# Fich ak egzèsis nan KIND

## Kote li ye

Nan **Préscolaire / Maternelle**, sou `/dashboard/preschool/overview`, nouvo onglet **Fiches et exercices** la ouvri jeneratè a andedan espas KIND la. Pa gen sit separe oswa nouvo aksè piblik.

## Fonksyon

- Sis aktivite an fransè: konte desen, adisyon, soustraksyon, lèt an pwentiye A–Z, swit fòm ak nonb ki manke.
- Twa seri desen orijinal: chat, pòm ak fize.
- Nivo PS1, PS2, PS3, CP, CE1 ak CE2. Aktivite yo se baz pou pratike; yo pa kouvri tout pwogram chak nivo.
- Kat oswa sis egzèsis; koulè oswa nwa e blan pou kolorye.
- Nouvo varyant avèk aperçus imedya.
- Enpresyon A4 / sove an PDF atravè fenèt enpresyon navigatè a. Se pa yon telechajman PDF ki fèt sou sèvè a.
- Koreksyon oswa konsèy pou granmoun sou yon dezyèm paj si yo chwazi opsyon an.

## Non lekòl ak aksè

Non lekòl la soti nan `school_context` ki deja sèvi pou sesyon AtechOS la. Li afiche sou aperçu, fich ak paj granmoun ansanm ak AtechOS. Itilizatè a pa antre yon lòt non lekòl nan fòm nan. San non lekòl, bouton enprime a rete dezaktive.

Jeneratè a suiv aksè ki deja egziste nan KIND pou administrasyon, anseyan, censeur ak kowòdonatè preskolè. Pa gen nouvo pèmisyon, migrasyon, depo done oswa kont timoun. Pa gen chanjman nan baz done ni nouvo depandans.

## Verifikasyon

- `node tests/preschool-worksheets.mjs`: 36 konbinezon, konte desen kont repons, varyant repwodiktib, non lekòl, pwoteksyon karaktè espesyal, 26 lèt, nwa e blan ak entegrasyon nan onglet KIND.
- Tès navigatè sou vrè konpozan KIND la nan yon paj tès tanporè: chwa egzèsis, tèm, lèt, varyant, koreksyon, non lekòl egzanp, 390/768/1440 px ak PDF yon/de paj.
- `npm test`: seri tès AtechOS ki te egziste a pase.
- `npm run typecheck` ak `npm run build`: verifye nan kopi lokal la.

Paj tès tanporè a retire nan sous final la. Non « École des Étoiles — Exemple » nan captures ak PDF demonstrasyon yo se done tès, pa yon lekòl itilizatè a konfime. Koneksyon nan yon kont reyèl ak enprimant fizik poko teste. Validasyon pa yon pwofesyonèl edikasyon poko fèt.

## Estati

Entegrasyon lokal baze sou `origin/main` commit `5c17bd2`. Pa gen push, piblikasyon, acha oswa chanjman nan baz done. Branch lokal: `codex/educational-resources`.
