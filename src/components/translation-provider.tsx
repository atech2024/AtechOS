'use client'
import {createContext,useContext,type ReactNode} from 'react'
import type {Locale} from '@/lib/i18n'
import {translate} from '@/lib/translations'
const LocaleContext=createContext<Locale>('ht')
export function TranslationProvider({locale,children}:{locale:Locale;children:ReactNode}){return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>}
export function T({text}:{text:string}){return translate(text,useContext(LocaleContext))}
