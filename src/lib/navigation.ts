export type NavigationItem={label:string;href:string;icon:string;roles:string[]}
const administration=['school_admin','director','secretary']
export const navigation:NavigationItem[]=[
 {label:'Dashboard',href:'/dashboard',icon:'dashboard',roles:['*']},
 {label:'Students',href:'/dashboard/students',icon:'students',roles:[...administration,'teacher','surveillant']},
 {label:'Parents',href:'/dashboard/parents',icon:'parents',roles:administration},
 {label:'Subjects & Teachers',href:'/dashboard/subjects',icon:'teachers',roles:administration},
 {label:'Classes',href:'/dashboard/classes',icon:'classes',roles:administration},
 {label:'Attendance',href:'/dashboard/attendance',icon:'attendance',roles:[...administration,'teacher','surveillant']},
 {label:'Student Badges',href:'/dashboard/badges',icon:'badge',roles:[...administration,'surveillant']},
 {label:'Grading periods',href:'/dashboard/grading-periods',icon:'calendar',roles:administration},
 {label:'Grades',href:'/dashboard/grades',icon:'grades',roles:[...administration,'teacher']},
 {label:'Publication des bulletins',href:'/dashboard/publication',icon:'publication',roles:['school_admin','director']},
 {label:'Bulletins',href:'/dashboard/bulletins',icon:'reports',roles:[...administration,'surveillant']},
 {label:'Assignments',href:'/dashboard/assignments',icon:'assignments',roles:[...administration,'teacher']},
 {label:'Academic progression',href:'/dashboard/progression',icon:'progression',roles:['school_admin','director']},
 {label:'Teacher requests',href:'/dashboard/teacher-requests',icon:'requests',roles:['school_admin','director']},
 {label:'Users & staff',href:'/dashboard/staff',icon:'users',roles:['school_admin']},
 {label:'Grading settings',href:'/dashboard/grading-settings',icon:'settings',roles:administration},
 {label:'Parent Portal',href:'/dashboard/parent-portal',icon:'parents',roles:['parent']},
 {label:'Family bulletins',href:'/dashboard/family-bulletins',icon:'reports',roles:['parent']},
]
export function permittedNavigation(roles:string[],owner=false){return navigation.filter(n=>n.roles.includes('*')||n.roles.some(r=>roles.includes(r))||(owner&&!n.roles.includes('parent')))}
