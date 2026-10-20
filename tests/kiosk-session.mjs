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
assert.match(kiosk,/aria-expanded=\{historyOpen\}[\s\S]*?aria-controls="scan-history-content"[\s\S]*?setHistoryOpen/,'operators can collapse and reopen scan history')
assert.match(kiosk,/<ol className="max-h-\[420px\][\s\S]*?grid-cols-\[minmax\(0,1fr\)_auto\]/,'scan history uses narrow-screen friendly list rows instead of a wide table')
assert.match(kiosk,/role=\{notice\.tone==='error'\?'alert':'status'\}/,'live scan results and errors are announced accessibly')
assert.match(styles,/@media \(prefers-reduced-motion:reduce\)[^}]*\.kiosk-scan-reflection[^}]*animation:none/,'badge reflection respects reduced-motion preference')
assert.match(styles,/data-motion-active="true"\] \.kiosk-scan-badge[^}]*animation:[^;]+infinite/,'badge scan animation repeats continuously while its guide is active')
assert.match(styles,/data-motion-active="true"\] \.kiosk-scan-reflection[^}]*animation:[^;]+infinite/,'holographic reflections repeat with the badge scan')
assert.match(styles,/data-motion-active="true"\] \.kiosk-scan-beam[^}]*animation:[^;]+infinite/,'scanner beam repeats with the badge scan')
assert.match(styles,/data-motion-active="true"\] \.kiosk-scan-confirm[^}]*animation:[^;]+infinite/,'scan confirmation repeats with the badge scan')
assert.match(styles,/@media \(max-width:639px\)[\s\S]*?\.kiosk-scan-demo-compact \{ display:block; \}[\s\S]*?kiosk-badge-scan-compact/,'the phone layout uses a compact, uncropped badge scan illustration')
assert.match(styles,/\.kiosk-motion-toggle \{ display:none; \}/,'reduced-motion users do not see a control for an animation that is disabled')
assert.match(kiosk,/aria-pressed=\{scanGuidePaused\}[\s\S]*setScanGuidePaused[\s\S]*Pause badge animation/,'users can pause and resume the decorative loop without stopping the camera')
assert.match(kiosk,/document\.visibilityState==='visible'&&isIntersecting/,'continuous motion is enabled only while the guide is visible and the page is active')
assert.match(kiosk,/<details className="kiosk-schedule[\s\S]*?<T text="KIOS uses the entry and checkout hours configured by the school, in Haiti local time\."/,'KIOS schedule guidance is compact and does not hard-code school hours')
assert.ok(kiosk.indexOf('notice-title')<kiosk.indexOf('<QRScanner'),'live scan feedback is positioned before the camera view')
assert.match(scanner,/facingMode:\{ideal:mode\}[\s\S]*?chooseCamera/,'operators can switch between front and back cameras while scanning')
assert.match(kiosk,/kiosk-scan-guide[\s\S]*role="img"[\s\S]*kiosk-scan-badge[\s\S]*kiosk-scan-reflection/,'a decorative, accessible student badge moves through the scanner with a reflective finish')
for(const key of ['School attendance station','Scan a student badge','Camera active. Scan a badge; it stays on for the next person.','The camera stays on until you stop it. Scans appear in the history.','Illustration: a student badge moves over the scanner, is read, then attendance is confirmed.','Pause badge animation','Resume badge animation','Latest scan notification','Scanned students','No scans yet','Visible for 10 seconds']) {
 assert.ok(translations.includes(`'${key}':[`),`${key} has French and Haitian Creole translations`)
}
for(const key of ['Haiti schedule','Show scan history','Hide scan history','Front camera','Back camera','Camera facing']) { assert.ok(translations.includes(`'${key}':[`),`${key} has French and Haitian Creole translations`) }
console.log('PASS KIOS session UX: persistent camera, front/back switch, collapsible responsive history, compact Haiti hours, camera-first feedback, localization and reduced motion.')
