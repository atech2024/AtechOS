import type {Locale} from './i18n'
import {schoolDate} from './school-date'

const guardStatuses:Record<string,Record<Locale,string>>={
 needs_family_reason:{fr:'Motif familial attendu',ht:'N ap tann rezon fanmi an',en:'Family reason needed'},
 reason_submitted:{fr:'Motif transmis à l’école',ht:'Rezon an voye bay lekòl la',en:'Reason submitted to school'},
 meeting_required:{fr:'Rencontre avec la famille requise',ht:'Rankont ak fanmi an nesesè',en:'Family meeting required'},
 deadline_passed:{fr:'Délai dépassé',ht:'Dat limit la pase',en:'Deadline passed'},
 resolved:{fr:'Dossier résolu',ht:'Dosye a rezoud',en:'Case resolved'},
}
const guardKinds:Record<string,Record<Locale,string>>={
 absence:{fr:'absence',ht:'absans',en:'absence'},
 lateness:{fr:'retard',ht:'reta',en:'lateness'},
}

export function familyNotificationTitle(type:string,title:string,locale:Locale){
 if(type!=='guard')return title
 const match=/^GUARD · ([a-z_]+)$/.exec(title)
 return match&&guardStatuses[match[1]]?`GUARD · ${guardStatuses[match[1]][locale]}`:title
}

export function familyNotificationDescription(type:string,description:string,locale:Locale){
 if(type!=='guard')return description
 const match=/^(.*) · (absence|lateness) · (\d{4}-\d{2}-\d{2})$/.exec(description)
 return match?`${match[1]} · ${guardKinds[match[2]][locale]} · ${schoolDate(match[3],locale)}`:description
}

export function familyNotificationDestination(type:string,href:string,eventKey:string|null){
 if(type!=='guard'||href!=='/dashboard/parent-portal')return href
 const match=/^guard:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):[a-z_]+$/i.exec(eventKey||'')
 return match?`/dashboard/guard?case=${match[1]}`:'/dashboard/guard'
}
