import raw from './kind-catalogue.json'
import {getArt,renderArt} from './kind-art'
import type {Worksheet} from './preschool-worksheets'
export const kindCategories=[{id:'numbers',label:'Chiffres et nombres'},{id:'coloring',label:'Coloriages'},{id:'step-by-step-drawing',label:'Dessiner pas à pas'},{id:'general-knowledge',label:'Découverte du monde'},{id:'matching-worksheets',label:'Associer et observer'}] as const
export type KindCategory=typeof kindCategories[number]['id']
export type LibraryCard={id:string;category:string;seed:number;mode:string;subject:string;title:string;level:string;min:number;variant:number;number?:number;start?:number;end?:number;topic?:string;adaptationNote:string}
export const libraryCards=raw as LibraryCard[]
export const escapeXML=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!))
export function libraryTitle(card:LibraryCard){if(card.title)return card.title+(card.variant>1&&card.category!=='matching-worksheets'?` — atelier ${card.variant}`:'');const verbs:Record<string,string>={'color-art':'Je colorie','color-code':'Je colorie avec les nombres','trace-art':'Je trace et je colorie','draw-steps':'Je dessine','complete-art':'Je complète le dessin'};return `${verbs[card.mode]||'Je découvre'} : ${getArt(card.subject).label}${card.variant>1?' — scène '+card.variant:''}`}
export const subjectSets:Record<string,string[]>={
 mixed:['cat','apple','house','bus','bee','book','car','flower','ball','fish','tree','cup','moon','bird','boat','clock','rabbit','carrot','star','umbrella','bear','rocket','pear','cake','earth','balloon','dog','banana','gift','tshirt','mouse','bicycle','cherry','cow','mushroom','cloud','elephant','laptop','frog','ladybug','penguin','snail','camera','bread','turtle','pig','orange','butterfly','kite'],
 animals:['cat','dog','bear','rabbit','elephant','giraffe'],africa:['lion','elephant','giraffe','monkey','cheetah','crocodile'],arctic:['bear','fox','whale','narwhal'],birds:['bird','duck','owl','toucan','eagle','parrot'],desert:['camel','fox','snake','lizard'],farm:['cow','pig','sheep','horse','chicken','goat'],sea:['fish','octopus','turtle','starfish','dolphin','seahorse'],forest:['fox','bear','squirrel','deer','hedgehog','owl'],fruits:['apple','pear','banana','orange','grapes','strawberry','mango','pineapple','watermelon','lemon','cherry','avocado'],halloween:['pumpkin','ghost','bat','cat'],insects:['bee','ant','butterfly','ladybug','dragonfly'],shapes:['circle','square','triangle','star'],christmas:['gift','christmastree','wreath','snowman','santa','star'],celebration:['balloon','star','cake','gift','heart','flower'],vegetables:['carrot','broccoli','onion','pepper','beetroot','eggplant'],transport:['car','bus','boat','airplane','bicycle','train'],weather:['sun','cloud','snowflake','rainbow'],senses:['eye','ear','nose','mouth','hand'],sports:['ball','racket','bowling','bicycle'],spring:['flower','butterfly','bee','cloud'],big:['elephant','whale','giraffe','bear'],small:['ant','ladybug','mouse','bee'],safety:['hand','sign','stop','eye'],warning:['sign','stop','hand','eye'],traffic:['stop','sign','car','bicycle']
}
subjectSets.mixed=subjectSets.mixed.filter(x=>!['kite'].includes(x));subjectSets.desert=subjectSets.desert.map(x=>x==='lizard'?'iguana':x)
const text=(s:string,x:number,y:number,size=15,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escapeXML(s)}</text>`
function shuffled<T>(list:T[],seed:number){const result=[...list];let state=seed>>>0;for(let i=result.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const n=state%(i+1);[result[i],result[n]]=[result[n],result[i]]}return result}
function frame(school:string,title:string,level:string,body:string,instruction:string,color:boolean){
 const words=school.trim().slice(0,120).match(/.{1,48}(?:\s|$)|.{1,48}/g)||[''],schoolLines=words.map(w=>w.trim())
 const heading=schoolLines.slice(0,3).map((line,i)=>text(line,32,51+i*17,schoolLines.length>1?13:18,'font-weight="bold"')).join('')
 return `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842"><rect width="595" height="842" fill="white"/><g font-family="Arial,sans-serif" fill="#172d48"><path d="M32 24h531" stroke="${color?'#056cd3':'#172d48'}" stroke-width="3"/>${heading}${text('AtechOS · KIND',563,103,13,'text-anchor="end" font-weight="bold"')}${text(level+' · Fiche en français',32,103,11)}${text(title,32,137,title.length>54?17:title.length>39?20:24,'font-weight="bold"')}${text('Prénom : __________________________   Date : _______________',32,163,12)}${text(instruction,32,187,instruction.length>80?10:12)}${body}<path d="M32 800h531" stroke="#afbdd0"/>${text('Créé avec AtechOS · '+school.slice(0,75),32,820,9)}</g></svg>`
}
const digits:Record<string,string>={'0':'M22 2C-4 2-4 58 22 58C48 58 48 2 22 2Z','1':'M9 16L23 2V58M7 58H39','2':'M4 14C10-9 46 1 39 19Q37 28 4 58H42','3':'M3 4H40L20 27Q49 23 39 48Q29 66 3 53','4':'M30 58V2L2 40H43','5':'M40 2H7V25Q43 12 42 43Q40 66 4 53','6':'M39 5Q1-11 3 43Q5 70 34 55Q54 32 25 26Q10 23 4 37','7':'M3 2H42L14 58M10 30H35','8':'M22 2C-3 2-3 30 22 30C48 30 48 2 22 2ZM22 30C-5 30-5 58 22 58C50 58 50 30 22 30Z','9':'M40 24Q38-5 12 4Q-6 21 12 31Q28 42 40 24Q43 67 5 55'}
function numeral(n:number,x:number,y:number,scale=1,dotted=false){return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="#172d48" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${dotted?'stroke-dasharray="2 4"':''}>${String(n).split('').map((digit,i)=>`<path d="${digits[digit]}" transform="translate(${i*50} 0)"/>`).join('')}</g>`}
function artGrid(ids:string[],seed:number,color:boolean,shadow=false){const selected=ids.length>=6?shuffled(ids,seed).slice(0,6):ids;const right=shuffled(selected,seed+31);let body='';const answers:string[]=[];selected.forEach((id,i)=>{const y=245+i*76;body+=text(String(i+1)+'.',40,y+20,12)+renderArt(id,{x:63,y:y-30,size:64,color,variant:i})+`<circle cx="164" cy="${y+4}" r="3" fill="#172d48"/>`;const other=right[i];body+=text(String.fromCharCode(65+i)+'.',346,y+20,12);body+=shadow?renderArt(other,{x:425,y:y-30,size:64,silhouette:true}):text(getArt(other).label,390,y+11,16);answers.push(`${i+1} → ${String.fromCharCode(65+right.indexOf(id))} : ${getArt(id).label}`)});return {body,answers}}
export function generateLibraryWorksheet(card:LibraryCard,schoolName:string,options:{color?:boolean;seed?:number;aslImage?:string}={}):Worksheet{
 const seed=(options.seed??card.seed)>>>0,color=options.color??true,title=libraryTitle(card);let body='',answers:string[]=[],instruction=''
 const a=(id:string,x:number,y:number,size:number,opts:Parameters<typeof renderArt>[1]={})=>renderArt(id,{x,y,size,color,...opts})
 if(card.mode==='trace-number'){
  const n=card.number||1;instruction='Observe le nombre. Compte les images, trace, puis écris tout seul.'
  body+=numeral(n,55,224,1.8)+text(['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix'][n],52,367,27,'font-weight="bold"')
  for(let i=0;i<n;i++)body+=a(card.subject,245+i%5*57,223+Math.floor(i/5)*66,53)
   for(let row=0;row<3;row++){const y=428+row*95;body+=`<path d="M35 ${y}h525M35 ${y+58}h525" stroke="#b4c3d5" fill="none"/>`;for(let j=0;j<5;j++)body+=numeral(n,50+j*99,y,.8,true)}
   if(card.variant===2){body+=`<rect x="32" y="396" width="531" height="286" fill="white"/>`+text('Repasse sur le nombre, puis observe les dix cases.',40,420,15);for(let j=0;j<5;j++)body+=numeral(n,50+j*99,444,.8,true);for(let j=0;j<10;j++){const x=53+j%5*100,y=535+Math.floor(j/5)*65;body+=`<rect x="${x}" y="${y}" width="82" height="55" fill="none" stroke="#94a3b8"/>`;if(j<n)body+=a(card.subject,x+22,y+6,42)}body+=text(`Dessine ${n} petits points dans les cases du bas.`,40,695,15)}
   if(card.variant>=3){body+=`<rect x="32" y="396" width="531" height="286" fill="white"/>`+text(`Entoure tous les nombres ${n}.`,40,425,17);let found=0;for(let row=0;row<2;row++)for(let col=0;col<8;col++){const target=(row*8+col+seed)%3===0,value=target?n:(n+col+row+1)%11;if(value===n)found++;body+=text(String(value),58+col*65,476+row*72,30,'text-anchor="middle"')}body+=text('Trace le nombre, puis essaie tout seul dans les cases.',40,592,15);for(let col=0;col<5;col++)body+=numeral(n,50+col*99,613,.8,true);answers.push(`Dans la grille, ${found} occurrences du nombre ${n} sont à entourer.`)}
  for(let i=0;i<5;i++)body+=`<rect x="${48+i*101}" y="730" width="78" height="53" rx="3" fill="none" stroke="#8195ad"/>`;answers.push(`Le nombre est ${n}. On doit retrouver ${n} image${n>1?'s':''}.`,'Accompagner le tracé sans imposer la vitesse.')
 }else if(card.mode==='number-sequence'){
  const start=card.start||1,end=card.end||20,total=end-start+1,cols=10,rows=Math.ceil(total/cols),height=Math.min(58,500/rows),top=249,missing:number[]=[]
  instruction=`Complète les cases vides pour retrouver les nombres de ${start} à ${end}.`
  for(let n=start;n<=end;n++){const i=n-start,x=36+i%cols*52,y=top+Math.floor(i/cols)*height,hide=i!==0&&i!==total-1&&(i+seed)%3===0;body+=`<rect x="${x}" y="${y}" width="48" height="${height-4}" rx="4" fill="none" stroke="#94a3b8"/>`;if(hide)missing.push(n);else body+=text(String(n),x+24,y+(height-4)/2+6,rows>7?14:18,'text-anchor="middle"')}
  if(top+rows*height<700)body+=a(card.subject,237,722,65);answers=[`Nombres à retrouver : ${missing.join(', ')}.`]
 }else if(card.mode==='number-review'){
  instruction='Repasse sur les chiffres. Écris le nombre d’images dans les cases.'
  for(let n=1;n<=10;n++){const row=Math.floor((n-1)/2),col=(n-1)%2,x=36+col*274,y=230+row*108;body+=numeral(n,x,y,.85,true);for(let i=0;i<n;i++)body+=a(['star','flower','apple'][card.variant%3],x+82+i%5*29,y+Math.floor(i/5)*29,26);body+=`<rect x="${x+89}" y="${y+65}" width="132" height="24" fill="none" stroke="#94a3b8"/>`;answers.push(`${n} : tracer ${n}, puis écrire ${n} pour la collection montrée.`)}
 }else if(['color-art','trace-art','color-code'].includes(card.mode)){
  instruction=card.mode==='color-code'?'Observe le code. Colorie chaque zone numérotée avec la bonne couleur.':card.mode==='trace-art'?'Repasse sur les contours en pointillés, puis colorie ton dessin.':'Colorie ce dessin à ta façon. Tu peux ajouter un décor autour.'
  const code=card.mode==='color-code';body+=a(card.subject,77,243,440,{color:false,code,dotted:card.mode==='trace-art',variant:card.variant})
  if(code){['jaune','vert','violet'].slice(0,getArt(card.subject).regions.length).forEach((name,i)=>{body+=`<rect x="${50+i*170}" y="721" width="22" height="22" fill="${['#f4bb61','#8ecbb1','#baace0'][i]}" stroke="#172d48"/>`+text(`${i+1} : ${name}`,80+i*170,738,14)});answers=getArt(card.subject).regions.map((_,i)=>`${i+1} : ${['jaune','vert','violet'][i]}.`)}else {body+=text('Mes couleurs : ______________________________________',50,750,16);answers=['Création libre : observer le geste, la prise du crayon et les choix de couleurs.']}
  if(card.variant>1&&!code){body+=a(['star','heart','flower','cloud'][seed%4],33,213,45,{color:false})+a(['moon','butterfly','star','sun'][seed%4],510,694,44,{color:false})}
 }else if(card.mode==='draw-steps'){
  const steps=Math.min(6,getArt(card.subject).parts.length);instruction=`Observe les ${steps} étapes. Ajoute les nouveaux traits, puis dessine en bas.`
  for(let i=0;i<steps;i++){const x=34+i%3*180,y=217+Math.floor(i/3)*205;body+=`<rect x="${x}" y="${y}" width="167" height="188" rx="7" fill="none" stroke="#b8c6d5"/>`+text(`Étape ${i+1}`,x+12,y+21,13,'font-weight="bold"')+a(card.subject,x+12,y+35,145,{stage:(i+1)*6/steps,color:false})}
  body+=text('À ton tour !',40,660,18,'font-weight="bold"')+`<rect x="35" y="673" width="525" height="108" rx="7" fill="none" stroke="#b8c6d5"/>`;answers=['Les étapes montrent une construction progressive du dessin. Valoriser les essais plutôt qu’une copie parfaite.']
 }else if(card.mode==='complete-art'){
  instruction='Observe la moitié du modèle. Dessine l’autre moitié à droite du trait.'
  body+=`<defs><clipPath id="left-half"><rect x="74" y="230" width="223" height="450"/></clipPath></defs><g clip-path="url(#left-half)">${a(card.subject,74,230,446,{color:false})}</g><path d="M297 222v485" stroke="#8195ad" stroke-dasharray="5 6"/>`+text('Modèle',107,737,16)+text('À compléter',365,737,16);answers=['Observer la silhouette et compléter le dessin de part et d’autre de l’axe. Le dessin reste une activité artistique.']
 }else if(card.mode==='match-word'||card.mode==='match-shadow'){
  instruction=card.mode==='match-shadow'?'Relie chaque image à sa silhouette.':'Lis avec l’adulte. Relie chaque image au mot qui lui correspond.'
  const pool=subjectSets[card.topic||'mixed']||subjectSets.mixed;let ids=pool
  if(card.topic==='mixed'){const offset=((card.variant||1)-1)*3;ids=Array.from({length:6},(_,i)=>pool[(offset+i)%pool.length])}
  const grid=artGrid(ids,seed,color,card.mode==='match-shadow');body=grid.body;answers=grid.answers
 }else{
  const topic=card.topic||'animals'
  if(topic==='asl'){
   instruction='Observe cet alphabet ASL avec un adulte, puis épelle ton prénom.'
   if(options.aslImage?.startsWith('data:image/png;base64,'))body+=`<image href="${options.aslImage}" x="80" y="205" width="435" height="554" preserveAspectRatio="xMidYMid meet"/>`
   else body+=text('Chargement du modèle ASL vérifié…',65,350,19)
   body+=text('ASL : alphabet américain, différent de la LSF ; pas une langue universelle.',32,775,10)+text('Photographies : Cwterp · domaine public · Wikimedia Commons',32,790,8);answers=['Modèle photographique : Cwterp, domaine public, Wikimedia Commons.','Les lettres J et Z incluent un mouvement, indiqué sur la planche.','Avec une personne compétente, observer les orientations et les mouvements. L’ASL et la LSF sont des langues distinctes.']
  }else if(topic==='moon'){
   instruction='Observe les phases dans l’ordre. Retrouve la nouvelle et la pleine Lune.'
   const names=['Nouvelle Lune','Premier croissant','Premier quartier','Gibbeuse croissante','Pleine Lune','Gibbeuse décroissante','Dernier quartier','Dernier croissant']
   names.forEach((name,i)=>{const x=95+i%4*135,y=291+Math.floor(i/4)*210;let lit='';if(i===4)lit='<circle r="42" fill="white"/>';else if(i===2||i===6)lit=`<path d="M0 -42A42 42 0 0 ${i===2?1:0} 0 42Z" fill="white"/>`;else if(i>0){const right=i<4,large=i===3||i===5;lit=`<path d="M0 -42A42 42 0 0 ${right?1:0} 0 42A${large?28:28} 42 0 0 ${large?(right?1:0):(right?0:1)} 0 -42Z" fill="white"/>`}body+=`<g transform="translate(${x} ${y})"><circle r="42" fill="#172d48"/>${lit}<circle r="42" fill="none" stroke="#172d48"/></g>`+text(name,x,y+67,name.length>18?10:12,'text-anchor="middle"')});body+=text('Les dessins montrent un cycle simplifié vu depuis l’hémisphère Nord.',36,687,12)+text('La partie éclairée de la Lune change d’apparence au cours du cycle.',36,719,12);answers=['Nouvelle Lune : disque sombre. Pleine Lune : disque entièrement éclairé.','Ordre des huit phases vérifié auprès de NASA Science.']
  }else if(topic==='months'||topic==='calendar'){
   const months=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];instruction=topic==='months'?'Écris les mois manquants. Tu peux t’aider de la banque de mots.':'Décore une case chaque jour de décembre, du 1 au 24.'
   const total=topic==='months'?12:24;for(let i=0;i<total;i++){const cols=topic==='months'?3:4,x=35+i%cols*(525/cols),y=230+Math.floor(i/cols)*(topic==='months'?111:80),hide=topic==='months'&&i%3===1;body+=`<rect x="${x}" y="${y}" width="${525/cols-7}" height="${topic==='months'?93:69}" rx="7" fill="none" stroke="#94a3b8"/>`+text(String(i+1),x+10,y+22,13);if(topic==='months'){if(!hide)body+=text(months[i],x+20,y+60,18);else answers.push(`${i+1} : ${months[i]}`)}else body+=a(['gift','star','christmastree','heart'][i%4],x+49,y+18,43,{color:false})}
   if(topic==='months')body+=text('Banque de mots : février · mai · août · novembre',38,730,16);else answers=['Calendrier créatif : il n’y a pas de réponse unique.']
  }else if(topic==='flower'||topic==='body'){
   instruction=topic==='flower'?'Relie chaque mot à la bonne partie de la plante.':'Repère les parties du corps avec un adulte. Relie les étiquettes.'
   body+=a(topic==='flower'?'flower':'person',110,235,375,{color})
   const labels=topic==='flower'?['pétales','feuille','tige']:['tête','bras','jambes'];const anchors=topic==='flower'?[[300,370],[225,511],[298,569]]:[[297,320],[187,470],[350,576]]
   labels.forEach((l,i)=>{body+=text(l,35,670+i*34,18)+`<circle cx="160" cy="${664+i*34}" r="3"/>`+`<circle cx="${anchors[i][0]}" cy="${anchors[i][1]}" r="4" fill="white" stroke="#172d48"/>`});answers=labels.map(l=>`Identifier : ${l}.`)
  }else if(topic==='seasons'){
   instruction='Observe les repères des quatre saisons des régions tempérées.'
   ;[['flower','printemps'],['sun','été'],['acorn','automne'],['snowflake','hiver']].forEach(([id,name],i)=>{const x=47+i%2*270,y=225+Math.floor(i/2)*245;body+=a(id,x+39,y,150)+text(name,x+112,y+185,24,'text-anchor="middle"')});body+=text('Ces quatre saisons ne décrivent pas tous les climats du monde.',36,766,12);answers=['printemps → fleur ; été → soleil ; automne → gland ; hiver → flocon.','Repères illustrés des régions tempérées : les climats et saisons varient selon le lieu.']
  }else if(topic==='europe'){
   instruction='Observe ces drapeaux simplifiés. Lis le nom des pays avec un adulte.'
   const countries=[['France','#0055a4','white','#ef4135'],['Italie','#009246','white','#ce2b37'],['Belgique','black','#fdda24','#ef3340'],['Allemagne','black','#dd0000','#ffcc00']]
   countries.forEach(([name,c1,c2,c3],i)=>{const x=55+i%2*268,y=235+Math.floor(i/2)*240;for(let n=0;n<3;n++)body+=`<rect x="${x+(i===3?0:n*52)}" y="${y+(i===3?n*35:0)}" width="${i===3?156:52}" height="${i===3?35:105}" fill="${[c1,c2,c3][n]}" stroke="#718096" stroke-width=".3"/>`;body+=text(name,x+78,y+145,23,'text-anchor="middle"')});answers=['France : bleu, blanc, rouge. Italie : vert, blanc, rouge.','Belgique : noir, jaune, rouge (bandes verticales). Allemagne : noir, rouge, or (bandes horizontales).']
  }else if(topic==='monuments'){
   instruction='Observe ces silhouettes simplifiées et associe chaque monument à son pays.'
   ;[['taj','Taj Mahal','Inde'],['colosseum','Colisée','Italie'],['wall','Grande Muraille','Chine'],['pyramid','Pyramides de Gizeh','Égypte']].forEach(([id,name,country],i)=>{const x=45+i%2*270,y=219+Math.floor(i/2)*256;body+=a(id,x+38,y,150)+text(name,x+112,y+176,name.length>17?15:19,'text-anchor="middle"')+text(country,x+112,y+204,17,'text-anchor="middle"')});answers=['Taj Mahal → Inde ; Colisée → Italie ; Grande Muraille → Chine ; pyramides de Gizeh → Égypte.']
  }else if(topic==='festivals'){
   instruction='Observe les objets. Avec l’adulte, raconte une tradition que tu connais.'
   ;['gift','wreath','star','cake'].forEach((id,i)=>{const x=55+i%2*265,y=223+Math.floor(i/2)*240;body+=a(id,x+35,y,150)+text(getArt(id).label,x+108,y+180,20,'text-anchor="middle"')});body+=text('Les familles ne célèbrent pas toutes les mêmes fêtes.',36,762,13);answers=['Activité de langage ouverte : écouter les traditions de chaque famille, sans imposer une fête.']
  }else {
   instruction=topic==='senses'?'Relie chaque organe au sens qui lui correspond.':'Relie chaque image au mot qui lui correspond.'
   const ids=subjectSets[topic]||subjectSets.animals,grid=artGrid(ids,seed,color,false);body=grid.body;answers=grid.answers
   if(topic==='senses'){
    const labels:Record<string,string>={eye:'la vue',ear:'l’ouïe',nose:'l’odorat',mouth:'le goût',hand:'le toucher'}
    for(const id of ids)body=body.replace('>'+getArt(id).label+'</text>','>'+labels[id]+'</text>');answers=ids.map(id=>`${getArt(id).label} : ${labels[id]}.`)
   }
   if(topic==='big'||topic==='small'){instruction=topic==='big'?'Observe ces grands animaux. Associe chaque image à son nom.':'Observe ces petits animaux. Associe chaque image à son nom.';answers.push('On compare des exemples : cette fiche n’affirme pas de record mondial.')}
  }
 }
 const svg=frame(schoolName,title,card.level,body,instruction,color)
 return {svg,answers,title,options:{schoolName,level:card.level,kind:'count',theme:'animals',count:answers.length,seed,letter:'A',color}}
}
