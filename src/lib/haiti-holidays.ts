type Holiday={date:string;name:string}

function easterSunday(year:number):Date{
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3)
 const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451)
 const month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1
 return new Date(Date.UTC(year,month-1,day))
}
function shift(date:Date,days:number){const d=new Date(date);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function fixed(year:number,month:number,day:number,name:string):Holiday{return{date:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,name}}

export function haitiHolidaySuggestions(start:string,end:string):Holiday[]{
 const years=[Number(start.slice(0,4)),Number(end.slice(0,4))]
 const all:Holiday[]=[]
 for(const year of new Set(years)){
  const easter=easterSunday(year)
  all.push(
   fixed(year,1,1,'Independence Day / New Year'),
   fixed(year,1,2,'Ancestors’ Day'),
   {date:shift(easter,-48),name:'Carnival Monday'},
   {date:shift(easter,-47),name:'Carnival Tuesday'},
   {date:shift(easter,-46),name:'Ash Wednesday'},
   {date:shift(easter,-2),name:'Good Friday'},
   fixed(year,5,1,'Labour and Agriculture Day'),
   fixed(year,5,18,'Flag and Universities Day'),
   fixed(year,8,15,'Assumption Day'),
   fixed(year,9,20,'Dessalines Day'),
   fixed(year,10,17,'Dessalines Commemoration'),
   fixed(year,11,1,'All Saints’ Day'),
   fixed(year,11,2,'Day of the Dead'),
   fixed(year,11,18,'Vertières Day'),
   fixed(year,12,25,'Christmas Day'),
  )
 }
 return all.filter(h=>h.date>=start&&h.date<=end&&new Date(`${h.date}T12:00:00Z`).getUTCDay()!==0&&new Date(`${h.date}T12:00:00Z`).getUTCDay()!==6).sort((a,b)=>a.date.localeCompare(b.date))
}

