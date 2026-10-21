'use client'

import {createContext,useContext,useEffect,useMemo,type ReactNode} from 'react'
import {usePathname,useRouter,useSearchParams} from 'next/navigation'

export type AcademicYearOption={id:string;name:string;start_date:string;end_date:string;is_current:boolean}
type AcademicYearContextValue={years:AcademicYearOption[];year:AcademicYearOption|null;yearId:string;canSelect:boolean;setYearId:(id:string)=>void}
const AcademicYearContext=createContext<AcademicYearContextValue|null>(null)

export function AcademicYearProvider({children,years,currentYearId,canSelect}:{children:ReactNode;years:AcademicYearOption[];currentYearId:string|null;canSelect:boolean}){
 const router=useRouter(),pathname=usePathname(),params=useSearchParams(),requested=params.get('year')||''
 const year=canSelect?(years.find(item=>item.id===requested)||years.find(item=>item.id===currentYearId)||null):null
 const yearId=year?.id||''
 useEffect(()=>{
  if(!canSelect||!requested||years.some(item=>item.id===requested))return
  const next=new URLSearchParams(params.toString());next.delete('year')
  router.replace(`${pathname}${next.size?`?${next}`:''}`,{scroll:false})
 },[canSelect,pathname,params,requested,router,years])
 const value=useMemo<AcademicYearContextValue>(()=>({years,year,yearId,canSelect,setYearId(id){const next=new URLSearchParams(params.toString());if(id)next.set('year',id);else next.delete('year');router.replace(`${pathname}${next.size?`?${next}`:''}`,{scroll:false})}}),[years,year,yearId,canSelect,params,pathname,router])
 return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>
}

export function useAcademicYear(){const value=useContext(AcademicYearContext);if(!value)throw new Error('useAcademicYear must be used inside AcademicYearProvider');return value}
