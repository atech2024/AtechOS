'use client'

import Image from 'next/image'
import Link from 'next/link'
import { T } from '@/components/translation-provider'
import { useState, type FormEvent } from 'react'
import { studentLogin } from './actions'

export default function StudentLogin() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activation, setActivation] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const result = await studentLogin(new FormData(event.currentTarget))
      if (result?.error) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-svh bg-[#f4f7fb] px-4 pb-10 pt-20 text-[#081a35] md:px-8 md:pt-24">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex justify-center md:mb-8">
          <Link href="/" aria-label="AtechOS" className="inline-flex items-center gap-2.5 rounded-lg">
            <Image
              src="/landing/atechos-logo-mark.webp"
              alt=""
              width={44}
              height={44}
              priority
              className="h-11 w-11 object-contain mix-blend-multiply"
            />
            <Image
              src="/landing/atechos-logo-wordmark.webp"
              alt="AtechOS"
              width={136}
              height={40}
              priority
              className="h-auto w-[136px] mix-blend-multiply"
            />
          </Link>
        </header>

        <div className="grid overflow-hidden rounded-[24px] border border-[#dce5f0] bg-white shadow-[0_24px_70px_rgba(8,26,53,.11)] md:min-h-[590px] md:grid-cols-[.86fr_1.14fr]">
          <aside className="relative flex min-h-[210px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#081a35] via-[#0d2b51] to-[#12528b] px-7 py-8 text-white sm:px-9 md:min-h-full md:px-11 md:py-12">
            <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-32 h-72 w-72 rounded-full border border-white/15 shadow-[0_0_0_28px_rgba(255,255,255,.03),0_0_0_58px_rgba(255,255,255,.025)]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-32 h-72 w-72 rounded-full border border-[#f7a915]/30" />

            <div className="relative z-10">
              <span className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#a9d0ff]">
                <T text="Student portal" />
              </span>
              <h1 className="mt-4 max-w-sm font-serif text-[clamp(34px,5vw,52px)] font-medium leading-[1.04] tracking-[-.04em]">
                <T text="School management, made clearer" />
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-[#d4e0ef]">
                <T text="AtechOS · School management" />
              </p>
            </div>

            <div aria-hidden="true" className="relative z-10 mt-8 flex items-center gap-2">
              <span className="h-1 w-7 rounded-full bg-[#1680e8]" />
              <span className="h-1 w-7 rounded-full bg-[#f7a915]" />
              <span className="h-1 w-7 rounded-full bg-[#de4a33]" />
            </div>
          </aside>

          <section className="px-6 py-8 sm:px-10 sm:py-10 md:flex md:items-center md:px-12 md:py-14">
            <div className="mx-auto w-full max-w-[460px]">
              <div className="mb-7">
                <span className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[#1766bb]">
                  <T text="Student portal" />
                </span>
                <h2 className="mt-2 text-3xl font-bold tracking-[-.04em] text-[#081a35] sm:text-[38px]">
                  <T text="Sign in" />
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#64748b]">
                  <T text="Use your AtechOS ID and full name. For your first visit, ask the school for a private activation code." />
                </p>
              </div>

              <form onSubmit={submit} className="grid gap-5">
                <label className="grid gap-2 text-[13px] font-semibold text-[#253b56]">
                  <span><T text="AtechOS ID" /></span>
                  <input
                    required
                    name="code"
                    autoComplete="username"
                    className="min-h-[50px] w-full rounded-[11px] border border-[#cbd6e3] bg-white px-3.5 text-base font-normal text-[#081a35] outline-none transition focus:border-[#056cd3] focus:ring-4 focus:ring-[#056cd3]/15"
                  />
                </label>

                <label className="grid gap-2 text-[13px] font-semibold text-[#253b56]">
                  <span><T text="Full name" /></span>
                  <input
                    required
                    name="name"
                    autoComplete="name"
                    className="min-h-[50px] w-full rounded-[11px] border border-[#cbd6e3] bg-white px-3.5 text-base font-normal text-[#081a35] outline-none transition focus:border-[#056cd3] focus:ring-4 focus:ring-[#056cd3]/15"
                  />
                </label>

                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#dce7f4] bg-[#f6f9fd] px-3.5 py-2.5 text-[13px] font-medium leading-5 text-[#344b67]">
                  <input
                    type="checkbox"
                    checked={activation}
                    onChange={(event) => setActivation(event.target.checked)}
                    className="h-4 w-4 shrink-0 accent-[#056cd3]"
                  />
                  <span><T text="First activation / reset" /></span>
                </label>

                <label className="grid gap-2 text-[13px] font-semibold text-[#253b56]">
                  <span><T text={activation ? 'Private activation code' : 'PIN'} /></span>
                  <input
                    required
                    name="secret"
                    type="password"
                    autoComplete="current-password"
                    className="min-h-[50px] w-full rounded-[11px] border border-[#cbd6e3] bg-white px-3.5 text-base font-normal text-[#081a35] outline-none transition focus:border-[#056cd3] focus:ring-4 focus:ring-[#056cd3]/15"
                  />
                </label>

                {activation && (
                  <label className="grid gap-2 text-[13px] font-semibold text-[#253b56]">
                    <span><T text="Create PIN (optional, 6–12 digits)" /></span>
                    <input
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{6,12}"
                      autoComplete="new-password"
                      className="min-h-[50px] w-full rounded-[11px] border border-[#cbd6e3] bg-white px-3.5 text-base font-normal text-[#081a35] outline-none transition focus:border-[#056cd3] focus:ring-4 focus:ring-[#056cd3]/15"
                    />
                    <span className="text-xs font-normal leading-5 text-[#64748b]">
                      <T text="Without a PIN, access remains on this browser for 14 days. You will need a new school activation code on another device or after signing out." />
                    </span>
                  </label>
                )}

                {error && (
                  <p role="alert" className="rounded-xl border border-[#f2c4bc] bg-[#fff4f1] px-3.5 py-3 text-[13px] leading-5 text-[#9b3023]">
                    <T text={error} />
                  </p>
                )}

                <button
                  disabled={busy}
                  type="submit"
                  className="flex min-h-[52px] items-center justify-between rounded-[11px] bg-[#056cd3] px-4.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(5,108,211,.18)] transition hover:bg-[#0757a8] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f7a915] disabled:cursor-wait disabled:opacity-65"
                >
                  <T text="Sign in" />
                  <span aria-hidden="true" className="text-xl font-normal">→</span>
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
