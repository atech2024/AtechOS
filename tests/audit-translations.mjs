import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {join} from 'node:path'

const dictionary=readFileSync('src/lib/translations.ts','utf8')+'\n'+readFileSync('src/lib/translations-extra.ts','utf8')
const known=new Set([...dictionary.matchAll(/(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")\s*:/g)].map(m=>(m[1]||m[2]).replaceAll("\\'","'").replaceAll('\\"','"')))
const files=[]
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())walk(path);else if(path.endsWith('.tsx'))files.push(path)}}
walk('src')
const missing=[]
for(const file of files){const source=readFileSync(file,'utf8');for(const [,key] of source.matchAll(/<T\s+text="([^"]+)"/g)){if(!known.has(key))missing.push({file,key})}}
for(const key of ['Students & families','Preschool','School life','Teaching','Evaluation & results','Requests & follow-up','Administration','Family portals','Breadcrumb','Student follow-up cases'])if(!known.has(key))missing.push({file:'src/lib/navigation.ts',key})
for(const row of missing)console.log(`${row.file}: ${row.key}`)
assert.equal(missing.length,0,'Every static <T text="..."> label needs French and Haitian Creole translations.')
console.log(`Scanned ${files.length} TSX files; ${missing.length} static labels lack translations.`)
