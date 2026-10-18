import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const kiosk=readFileSync('src/app/kiosk/page.tsx','utf8')
const scanner=readFileSync('src/components/qr-scanner.tsx','utf8')
const translations=readFileSync('src/lib/translations-extra.ts','utf8')
const styles=readFileSync('src/app/globals.css','utf8')

assert.match(kiosk,/<QRScanner keepActive/,'KIOS badge scans keep the camera stream active')
assert.match(scanner,/if\(!keepActive\)[\s\S]*?control\.stop\(\)/,'continuous scanning stops only when the camera is not configured to stay active')
assert.match(scanner,/now-previous\.at<10000/,'a badge held in front of the camera is throttled to avoid repeated submissions')
assert.match(kiosk,/setTimeout\(\(\)=>setNotice\(null\),10000\)/,'the live scan notification clears after ten seconds')
assert.match(kiosk,/setLog\(current=>\[entry,\.\.\.current\]\.slice\(0,50\)\)/,'completed scans stay in the session list, capped to the latest 50')
assert.ok(kiosk.includes('/landing/atechos-logo-mark.webp')&&kiosk.includes('/landing/atechos-logo-wordmark.webp'),'the kiosk header uses the official AtechOS logo assets')
assert.match(kiosk,/atechos-logo-mark\.webp[\s\S]*?mix-blend-multiply[\s\S]*?atechos-logo-wordmark\.webp[\s\S]*?mix-blend-multiply/,'white logo canvases blend into the kiosk background')
assert.match(kiosk,/<T text="Scanned students"[\s\S]*?<table/,'the scan history is a labelled, accessible table')
assert.match(kiosk,/role=\{notice\.tone==='error'\?'alert':'status'\}/,'live scan results and errors are announced accessibly')
assert.match(styles,/@media \(prefers-reduced-motion:reduce\)[^}]*\.kiosk-scan-badge[^}]*animation:none/,'badge scan motion respects reduced-motion preference')
assert.match(styles,/\.kiosk-scan-badge[^}]*animation:[^;]+ 1 both/,'badge scan illustration plays once instead of looping beside the live camera')
assert.match(kiosk,/kiosk-intro grid gap-5[^\n]*xl:grid-cols/,'the time card stays below the title until there is enough room for a two-column layout')
assert.match(kiosk,/kiosk-scan-guide[\s\S]*kiosk-scan-badge[\s\S]*<T text="Badge scan"\/>/,'the kiosk explains the badge scan sequence with an animated illustration')
for(const key of ['School attendance station','Scan a student badge','Camera active. Scan a badge; it stays on for the next person.','The camera stays on until you stop it. Scans appear in the history.','Illustration: a student badge moves over the scanner, is read, then attendance is confirmed.','Badge scan','Present badge · Scan · Confirm','Latest scan notification','Scanned students','No scans yet','Visible for 10 seconds']) {
 assert.ok(translations.includes(`'${key}':[`),`${key} has French and Haitian Creole translations`)
}
console.log('PASS KIOS session UX: persistent camera, repeated-frame throttle, ten-second notice, session history, AtechOS branding, localization and reduced motion.')
