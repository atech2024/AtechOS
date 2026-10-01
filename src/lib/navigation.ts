export type NavigationItem={label:string;href:string;icon:string;roles:string[]}
const administration=['school_admin','director','secretary']
export const navigation:NavigationItem[]=[
 {label:'Dashboard',href:'/dashboard',icon:'dashboard',roles:['*']},
 {label:'Students',href:'/dashboard/students',icon:'students',roles:[...administration,'teacher','surveillant']},
 {label:'Parents',href:'/dashboard/parents',icon:'parents',roles:administration},
 {label:'Subjects & Teachers',href:'/dashboard/subjects',icon:'teachers',roles:administration},
 {label:'Classes',href:'/dashboard/classes',icon:'classes',roles:administration},
 {label:'Attendance',href:'/dashboard/attendance',icon:'attendance',roles:[...administration,'teacher','surveillant']},
 {label:'Kindergarten pickup',href:'/dashboard/attendance/kindergarten-pickup',icon:'attendance',roles:[...administration,'surveillant','censeur']},
 {label:'Student Badges',href:'/dashboard/badges',icon:'badge',roles:[...administration,'surveillant']},
 {label:'Exams and school calendar',href:'/dashboard/calendar',icon:'calendar',roles:[...administration,'teacher','surveillant','censeur']},
 {label:'Grading periods',href:'/dashboard/grading-periods',icon:'calendar',roles:administration},
 {label:'Grades',href:'/dashboard/grades',icon:'grades',roles:[...administration,'teacher']},
 {label:'Publication des bulletins',href:'/dashboard/publication',icon:'publication',roles:['school_admin','director','censeur']},
 {label:'Bulletins',href:'/dashboard/bulletins',icon:'reports',roles:[...administration,'surveillant']},
 {label:'Preschool competency bulletins',href:'/dashboard/preschool',icon:'reports',roles:[...administration,'teacher','censeur']},
 {label:'Assignments',href:'/dashboard/assignments',icon:'assignments',roles:[...administration,'teacher']},
 {label:'Academic progression',href:'/dashboard/progression',icon:'progression',roles:['school_admin','director']},
 {label:'Access approvals',href:'/dashboard/approvals',icon:'requests',roles:['school_admin','director','censeur']},
 {label:'Teacher requests',href:'/dashboard/teacher-requests',icon:'requests',roles:['school_admin','director']},
 {label:'Users & staff',href:'/dashboard/staff',icon:'users',roles:['school_admin']},
 {label:'Grading settings',href:'/dashboard/grading-settings',icon:'settings',roles:administration},
 {label:'GUARD cases',href:'/dashboard/guard',icon:'requests',roles:[...administration,'surveillant','parent']},
 {label:'Student Badges',href:'/dashboard/parent-badges',icon:'badge',roles:['parent']},
 {label:'Parent Portal',href:'/dashboard/parent-portal',icon:'parents',roles:['parent']},
 {label:'Family bulletins',href:'/dashboard/family-bulletins',icon:'reports',roles:['parent']},
]
export function permittedNavigation(roles:string[],owner=false){const capabilities=roles.includes('censeur')?[...roles,'surveillant']:roles;return navigation.filter(n=>n.roles.includes('*')||n.roles.some(r=>capabilities.includes(r))||(owner&&!n.roles.includes('parent')))}
