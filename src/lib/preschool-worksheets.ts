export const activityTypes = [
  {id:'count',label:'Je compte les images',description:'Observer, compter et écrire le nombre.'},
  {id:'add',label:'Mes petites additions',description:'Réunir deux collections avec des images.'},
  {id:'subtract',label:'Je retire et je compte',description:'Barrer les images retirées puis compter.'},
  {id:'letters',label:'Mes lettres à tracer',description:'Suivre les pointillés et essayer tout seul.'},
  {id:'patterns',label:'La suite des formes',description:'Repérer un rythme et dessiner la suite.'},
  {id:'numbers',label:'Les nombres cachés',description:'Retrouver les nombres qui manquent.'},
] as const
export type ActivityType=typeof activityTypes[number]['id']
export type WorksheetTheme='fruit'|'animals'|'space'
export type WorksheetOptions={schoolName:string;level:string;kind:ActivityType;theme:WorksheetTheme;count:number;seed:number;letter:string;color:boolean}
export type Worksheet={svg:string;answers:string[];title:string;options:WorksheetOptions}
export const worksheetLevels=['PS1','PS2','PS3','CP','CE1','CE2']
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!))
const ink='#172d48'
function picture(theme:WorksheetTheme,x:number,y:number,color:boolean,variant=0){
 const palette=color?['#ef775d','#6cb995','#f2c44d','#8d81cf']:['white','white','white','white']
 const fill=palette[variant%palette.length],line=`stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"`
 if(theme==='fruit')return `<g transform="translate(${x},${y})" ${line}><path d="M0 -12C-19 -24 -22 8 -9 19Q0 24 8 19C23 5 18 -24 0 -12Z" fill="${fill}"/><path d="M0 -12Q-2 -23 6 -26" fill="none"/><path d="M3 -19Q18 -29 16 -17Q7 -13 3 -19" fill="${color?'#6cb995':'white'}"/><path d="M-13 -8q-4 5 -2 11" fill="none" stroke="${color?'white':ink}"/></g>`
 if(theme==='animals')return `<g transform="translate(${x},${y})" ${line}><path d="M-17 -3L-19 -24 -5 -15Q0 -18 6 -15L19 -24 17 -2Q26 21 0 23Q-26 21 -17 -3Z" fill="${fill}"/><path d="M-14 -15l1 10 7-6M14 -15l-1 10-7-6" fill="${color?'#f9c3bb':'white'}"/><circle cx="-7" cy="2" r="1.8" fill="${ink}"/><circle cx="7" cy="2" r="1.8" fill="${ink}"/><path d="M-3 8h6l-3 3z" fill="${ink}"/><path d="M0 11q-3 6-6 1M0 11q3 6 6 1M-12 8l-12-3M-12 12l-12 2M12 8l12-3M12 12l12 2" fill="none" stroke-linecap="round"/></g>`
 return `<g transform="translate(${x},${y})" ${line}><path d="M0 -25Q-17 -10-12 14H12Q17 -10 0 -25Z" fill="${fill}"/><path d="M-12 1l-10 17 11-3M12 1l10 17-11-3" fill="${color?'#8d81cf':'white'}"/><circle cy="-5" r="6" fill="white"/><path d="M-6 18l6 13 6-13" fill="${color?'#f2c44d':'white'}"/></g>`
}
function shape(which:number,x:number,y:number,color:boolean){const fill=color?['#f2c44d','#8d81cf','#6cb995'][which]:'white';const attrs=`fill="${fill}" stroke="${ink}" stroke-width="1.5"`;return which===0?`<circle cx="${x}" cy="${y}" r="13" ${attrs}/>`:which===1?`<rect x="${x-13}" y="${y-13}" width="26" height="26" rx="2" ${attrs}/>`:`<path d="M${x} ${y-16}l16 29h-32z" ${attrs}/>`}
export function generateWorksheet(input:WorksheetOptions):Worksheet{
 const options={...input,schoolName:input.schoolName.trim().slice(0,120),count:Math.max(4,Math.min(6,Math.floor(input.count)||6)),letter:input.letter.toUpperCase().replace(/[^A-Z]/g,'').slice(0,1)||'A'}
 const title=activityTypes.find(a=>a.id===options.kind)?.label||activityTypes[0].label
 let state=(options.seed>>>0)||1;const random=(max:number)=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return 1+(state%max)}
 const max=options.level==='PS1'?3:options.level==='PS2'?5:options.level==='CE1'?20:options.level==='CE2'?50:10
 const answers:string[]=[];let drawings=''
 const descriptions:Record<ActivityType,string>={count:'Compte les images et écris le nombre dans la case.',add:'Compte les deux groupes. Écris le total dans la case.',subtract:'Barre le nombre demandé. Combien d’images reste-t-il ?',letters:'Repasse sur la lettre en pointillés, puis écris-la dans les cases.',patterns:'Observe les formes. Dessine les deux formes qui suivent.',numbers:'Complète la suite avec les nombres qui manquent.'}
 for(let i=0;i<options.count;i++){
  const y=228+i*(490/options.count),h=490/options.count-9
  drawings+=`<rect x="35" y="${y-32}" width="525" height="${h}" rx="10" fill="${options.color?'#f6f8fc':'white'}" stroke="#b9c7d6"/><text x="46" y="${y-11}" font-size="10" fill="#52637a">${i+1}.</text>`
  if(options.kind==='count'||options.kind==='subtract'){
   const n=random(Math.min(max,8)),remove=options.kind==='subtract'?random(n):0
   for(let j=0;j<n;j++)drawings+=picture(options.theme,90+j*49,y+7,options.color,i%4)
   if(options.kind==='subtract')drawings+=`<text x="78" y="${y+h-38}" font-size="11">Barre ${remove} image${remove>1?'s':''}.</text>`
   drawings+=`<rect x="504" y="${y-14}" width="38" height="38" rx="4" fill="white" stroke="${ink}"/>`;answers.push(String(n-remove))
  }else if(options.kind==='add'){
   const a=random(Math.min(max,4)),b=random(Math.min(max,4));for(let j=0;j<a;j++)drawings+=picture(options.theme,86+j*41,y+7,options.color,i)
   drawings+=`<text x="247" y="${y+15}" font-size="25">+</text>`;for(let j=0;j<b;j++)drawings+=picture(options.theme,292+j*41,y+7,options.color,i+1)
   drawings+=`<text x="463" y="${y+15}" font-size="25">=</text><rect x="500" y="${y-14}" width="40" height="38" rx="4" fill="white" stroke="${ink}"/>`;answers.push(String(a+b))
  }else if(options.kind==='letters'){
   const paths:Record<string,string>={A:'M0 40L15 0L30 40M6 26H24',B:'M0 40V0H13C34 0 34 20 13 20H0M13 20C36 20 36 40 13 40H0',C:'M30 4C-8 -14 -8 54 30 36',D:'M0 0V40H9C39 40 39 0 9 0Z',E:'M30 0H0V40H30M0 20H23',F:'M30 0H0V40M0 20H23',G:'M30 5C-8 -14 -8 54 30 36V22H17',H:'M0 0V40M30 0V40M0 20H30',I:'M0 0H30M15 0V40M0 40H30',J:'M0 0H30M23 0V29Q23 50 3 35',K:'M0 0V40M30 0L0 23L30 40',L:'M0 0V40H30',M:'M0 40V0L15 22L30 0V40',N:'M0 40V0L30 40V0',O:'M15 0C-6 0 -6 40 15 40C36 40 36 0 15 0Z',P:'M0 40V0H13C35 0 35 23 13 23H0',Q:'M15 0C-6 0 -6 40 15 40C36 40 36 0 15 0ZM20 29L34 45',R:'M0 40V0H13C35 0 35 23 13 23H0M14 23L31 40',S:'M29 5C0 -13 -12 19 14 20C40 21 30 54 0 36',T:'M0 0H30M15 0V40',U:'M0 0V26C0 46 30 46 30 26V0',V:'M0 0L15 40L30 0',W:'M0 0L7 40L15 17L23 40L30 0',X:'M0 0L30 40M30 0L0 40',Y:'M0 0L15 20L30 0M15 20V40',Z:'M0 0H30L0 40H30'}
   drawings+=picture(options.theme,85,y+7,options.color,i)
   for(let j=0;j<3;j++)drawings+=`<path d="${paths[options.letter]}" transform="translate(${150+j*65},${y-14})" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 4" fill="none"/>`
   for(let j=0;j<2;j++)drawings+=`<rect x="${370+j*80}" y="${y-20}" width="58" height="52" rx="3" fill="white" stroke="#64748b"/>`;answers.push(`Lettre ${options.letter} : observer le geste, sans exiger une copie parfaite.`)
  }else if(options.kind==='patterns'){
   const a=random(3)-1,b=(a+random(2))%3;for(let j=0;j<4;j++)drawings+=shape(j%2?a:b,90+j*70,y+7,options.color)
   for(let j=0;j<2;j++)drawings+=`<rect x="${390+j*75}" y="${y-13}" width="40" height="40" rx="3" fill="white" stroke="${ink}"/>`;const names=['cercle','carré','triangle'];answers.push(`${names[b]}, ${names[a]}`)
  }else{
   const start=random(Math.max(1,max-4));for(let j=0;j<5;j++){const x=84+j*95;drawings+=`<rect x="${x-20}" y="${y-15}" width="50" height="40" rx="5" fill="white" stroke="#64748b"/>`;if(j!==1&&j!==3)drawings+=`<text x="${x+5}" y="${y+13}" font-size="22" text-anchor="middle">${start+j}</text>`}answers.push(`${start+1}, ${start+3}`)
  }
 }
 const school=escape(options.schoolName||'Nom de l’école indisponible'),size=options.schoolName.length>85?7:options.schoolName.length>65?9:options.schoolName.length>40?12:19
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842"><rect width="595" height="842" fill="white"/><g font-family="Arial,sans-serif" fill="${ink}"><path d="M35 38h525" stroke="${options.color?'#056cd3':ink}" stroke-width="4"/><text x="35" y="69" font-size="${size}" font-weight="bold">${school}</text><text x="560" y="96" font-size="15" font-weight="bold" text-anchor="end">AtechOS · KIND</text><text x="35" y="96" font-size="12">${escape(options.level)} · Activité en français</text><text x="35" y="134" font-size="25" font-weight="bold">${escape(title)}</text><text x="35" y="160" font-size="12">Prénom : _______________________   Date : _________________</text><text x="35" y="183" font-size="12">${descriptions[options.kind]}</text>${drawings}<text x="35" y="754" font-size="13">J’ai essayé, j’ai appris, j’ai grandi !</text>${picture(options.theme,520,758,options.color)}<path d="M35 795h525" stroke="#94a3b8"/><text x="35" y="816" font-size="10">${escape(options.schoolName.slice(0,70))} · Créé avec AtechOS · Activité originale</text></g></svg>`
 return {svg,answers,title,options}
}
export function worksheetPrintHTML(sheet:Worksheet,correction:boolean){
 const answers=correction?`<section class="answers"><h1>${escape(sheet.options.schoolName)} · AtechOS</h1><h2>${escape(sheet.title)} — accompagnement adulte</h2><ol>${sheet.answers.map(answer=>`<li>${escape(answer)}</li>`).join('')}</ol><p>Niveau indicatif : ${escape(sheet.options.level)}. Adaptez la durée et l’aide au rythme de l’enfant. Ces activités ne constituent pas une évaluation diagnostique.</p></section>`:''
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(sheet.title)} — AtechOS</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;font-family:Arial,sans-serif;color:#172d48}.activity{width:210mm;height:297mm;display:block}.answers{break-before:page;padding:18mm;width:210mm;min-height:297mm}h1{font-size:18px;overflow-wrap:anywhere}h2{font-size:22px}li{margin:16px 0;font-size:16px}p{font-size:14px;line-height:1.6}</style></head><body><div class="activity">${sheet.svg}</div>${answers}</body></html>`
}
