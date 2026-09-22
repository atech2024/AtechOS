export type Locale = 'ht' | 'fr' | 'en'
export const labels: Record<Locale, Record<string, string>> = {
  ht: { language: 'Lang', dashboard: 'Tablo kontwòl', students: 'Elèv', staff: 'Itilizatè ak anplwaye', save: 'Anrejistre', cancel: 'Anile', signIn: 'Konekte', signUp: 'Kreye kont' },
  fr: { language: 'Langue', dashboard: 'Tableau de bord', students: 'Élèves', staff: 'Utilisateurs et personnel', save: 'Enregistrer', cancel: 'Annuler', signIn: 'Se connecter', signUp: 'Créer un compte' },
  en: { language: 'Language', dashboard: 'Dashboard', students: 'Students', staff: 'Users & staff', save: 'Save', cancel: 'Cancel', signIn: 'Sign in', signUp: 'Create account' },
}
export function localeFrom(value: string | undefined): Locale { return value === 'fr' || value === 'en' ? value : 'ht' }

