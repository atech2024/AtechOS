'use client'

import { useEffect, useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, LoaderCircle, Save } from 'lucide-react'
import { T, useLocale } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'
import { dateInHaiti } from '@/lib/staff-profile'
import { translate } from '@/lib/translations'

type Profile = {
  address: string | null
  phone: string | null
  date_of_birth: string | null
  sex: string | null
  identity_document_type: string | null
  identity_document_number: string | null
  profile_photo_path: string | null
}

const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export function StaffSelfProfileForm({ schoolId, userId, initialProfile, initialPhotoUrl }: {
  schoolId: string
  userId: string
  initialProfile: Profile
  initialPhotoUrl: string | null
}) {
  const router = useRouter()
  const locale = useLocale()
  const t = (text: string) => translate(text, locale)
  const [profile, setProfile] = useState(initialProfile)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setPhotoFile(file)
    setError('')
    setNotice('')
    const nextUrl = file ? URL.createObjectURL(file) : null
    setObjectUrl(nextUrl)
    setPhotoUrl(nextUrl || initialPhotoUrl)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    const form = new FormData(event.currentTarget)
    const address = String(form.get('address') || '').trim()
    const phone = String(form.get('phone') || '').trim()
    const birthDate = String(form.get('date_of_birth') || '')
    const sex = String(form.get('sex') || '')
    const documentType = String(form.get('identity_document_type') || '')
    const documentNumber = String(form.get('identity_document_number') || '').trim()

    if (Boolean(documentType) !== Boolean(documentNumber)) {
      setError(t('Select an ID type and enter its number, or leave both blank.'))
      return
    }
    if (birthDate && birthDate > dateInHaiti()) {
      setError(t('The date of birth cannot be in the future.'))
      return
    }
    if (photoFile && (!PHOTO_TYPES[photoFile.type] || photoFile.size > MAX_PHOTO_BYTES)) {
      setError(t('Choose a JPG, PNG, or WebP image no larger than 5 MB.'))
      return
    }

    setSaving(true)
    let uploadedPath: string | null = null
    try {
      const supabase = createClient()
      if (photoFile) {
        const ext = PHOTO_TYPES[photoFile.type]
        uploadedPath = `${schoolId}/${userId}/profile/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('staff-profile-photos')
          .upload(uploadedPath, photoFile, { contentType: photoFile.type, cacheControl: '3600', upsert: false })
        if (uploadError) {
          await supabase.storage.from('staff-profile-photos').remove([uploadedPath])
          setError(t('Unable to upload the profile photo. Please try again.'))
          return
        }
      }

      const nextProfile = {
        school_id: schoolId,
        user_id: userId,
        address: address || null,
        phone: phone || null,
        date_of_birth: birthDate || null,
        sex: sex || null,
        identity_document_type: documentType || null,
        identity_document_number: documentNumber || null,
        profile_photo_path: uploadedPath || profile.profile_photo_path,
        updated_at: new Date().toISOString(),
      }
      const { error: saveError } = await supabase
        .from('staff_private_profiles')
        .upsert(nextProfile, { onConflict: 'school_id,user_id' })
      if (saveError) {
        if (uploadedPath) await supabase.storage.from('staff-profile-photos').remove([uploadedPath])
        setError(t('Unable to save your profile. Please try again.'))
        return
      }

      let photoCleanupFailed = false
      if (uploadedPath && profile.profile_photo_path) {
        const { error: removeError } = await supabase.storage.from('staff-profile-photos').remove([profile.profile_photo_path])
        photoCleanupFailed = Boolean(removeError)
      }
      setProfile({ ...nextProfile })
      setNotice(t(photoCleanupFailed ? 'Your profile was saved, but the previous photo could not be removed.' : 'Profile saved.'))
      if (uploadedPath) {
        const { data } = await supabase.storage.from('staff-profile-photos').createSignedUrl(uploadedPath, 900)
        setPhotoUrl(data?.signedUrl || objectUrl || initialPhotoUrl)
      }
      setPhotoFile(null)
      if (photoInputRef.current) photoInputRef.current.value = ''
      router.refresh()
    } catch {
      if (uploadedPath) {
        try { await createClient().storage.from('staff-profile-photos').remove([uploadedPath]) } catch { /* upload cleanup is best effort */ }
      }
      setError(t('Unable to save your profile. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return <form onSubmit={save} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
    <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700 ring-1 ring-slate-200">
        {photoUrl ? <img src={photoUrl} alt="" width={80} height={80} className="h-full w-full object-cover"/> : <Camera size={28} aria-hidden="true"/>}
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor="staff-profile-photo" className="block text-sm font-semibold text-slate-900"><T text="Profile photo"/></label>
        <p id="staff-photo-help" className="mt-1 text-sm text-slate-600"><T text="Choose a photo (JPG, PNG or WebP, up to 5 MB)"/></p>
        <input ref={photoInputRef} id="staff-profile-photo" name="profile_photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="staff-photo-help" onChange={choosePhoto} className="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-800 hover:file:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"/>
      </div>
    </div>

    <fieldset className="grid gap-5 md:grid-cols-2">
      <legend className="mb-4 text-lg font-semibold text-slate-950"><T text="Personal information"/></legend>
      <div className="space-y-2">
        <label htmlFor="staff-phone" className="block text-sm font-medium text-slate-800"><T text="Phone number"/></label>
        <input id="staff-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={profile.phone || ''} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition-colors focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100"/>
      </div>
      <div className="space-y-2">
        <label htmlFor="staff-address" className="block text-sm font-medium text-slate-800"><T text="Address"/></label>
        <input id="staff-address" name="address" type="text" autoComplete="street-address" maxLength={500} defaultValue={profile.address || ''} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition-colors focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100"/>
      </div>
      <div className="space-y-2">
        <label htmlFor="staff-birth-date" className="block text-sm font-medium text-slate-800"><T text="Date of birth"/></label>
        <input id="staff-birth-date" name="date_of_birth" type="date" autoComplete="bday" max={dateInHaiti()} defaultValue={profile.date_of_birth || ''} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition-colors focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100"/>
      </div>
      <div className="space-y-2">
        <label htmlFor="staff-sex" className="block text-sm font-medium text-slate-800"><T text="Sex"/></label>
        <select id="staff-sex" name="sex" autoComplete="sex" defaultValue={profile.sex || ''} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition-colors focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100">
          <option value=""><T text="Choose an option"/></option>
          <option value="female"><T text="Female"/></option>
          <option value="male"><T text="Male"/></option>
          <option value="unspecified"><T text="Prefer not to say"/></option>
        </select>
      </div>
    </fieldset>

    <fieldset className="grid gap-5 border-t border-slate-200 pt-6 md:grid-cols-2">
      <legend className="mb-4 text-lg font-semibold text-slate-950"><T text="Identity document"/></legend>
      <div className="space-y-2">
        <label htmlFor="staff-id-type" className="block text-sm font-medium text-slate-800"><T text="Identity document type"/></label>
        <select id="staff-id-type" name="identity_document_type" autoComplete="off" defaultValue={profile.identity_document_type || ''} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition-colors focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100">
          <option value=""><T text="Choose an option"/></option>
          <option value="national_id"><T text="National ID card"/></option>
          <option value="nif"><T text="NIF"/></option>
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="staff-id-number" className="block text-sm font-medium text-slate-800"><T text="Identity document number"/></label>
        <input id="staff-id-number" name="identity_document_number" type="text" autoComplete="off" spellCheck={false} maxLength={100} defaultValue={profile.identity_document_number || ''} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition-colors focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100"/>
      </div>
    </fieldset>

    <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"><T text="These personal details are private to your school account."/></p>
    {error && <p role="alert" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><Check size={16} className="mr-2 inline" aria-hidden="true"/>{notice}</p>}
    <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
      {saving ? <><LoaderCircle size={17} className="animate-spin" aria-hidden="true"/><T text="Saving profile…"/></> : <><Save size={17} aria-hidden="true"/><T text="Save profile"/></>}
    </button>
  </form>
}
