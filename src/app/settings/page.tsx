'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Globe, LogOut, Mail, Plus, Trash2, Save, Send } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { signOut } from '@/app/auth/actions'
import { DEFAULT_VENDORS } from '@/lib/constants'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

interface Vendor {
  id: string
  name: string
  email: string
  phone: string
  is_active: boolean
}

interface MechanicSetting {
  id: string
  name: string
  email: string
  loginCode: string
  is_active: boolean
  isNew?: boolean
}

const PARTS_RECIPIENTS_STORAGE_KEY = 'partsOrderRecipients'
const SMTP_SETTINGS_STORAGE_KEY = 'smtpSettings'

type SmtpSettings = {
  host: string
  port: string
  secure: boolean
  user: string
  pass: string
  from: string
}

type SmtpTestExplanation = {
  title: string
  summary: string
  actions: string[]
  technical: string
}

type SmtpTestFeedback =
  | { type: 'success'; message: string; recipient?: string }
  | { type: 'error'; explanation: SmtpTestExplanation; step?: string }

export default function SettingsPage() {
  const [vendors, setVendors] = useState<Vendor[]>(DEFAULT_VENDORS)
  const [mechanics, setMechanics] = useState<MechanicSetting[]>([])
  const [partsOrderRecipientEmail, setPartsOrderRecipientEmail] = useState('')
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    host: '',
    port: '465',
    secure: true,
    user: '',
    pass: '',
    from: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [smtpTestTo, setSmtpTestTo] = useState('')
  const [isSmtpTesting, setIsSmtpTesting] = useState(false)
  const [smtpTestFeedback, setSmtpTestFeedback] = useState<SmtpTestFeedback | null>(null)
  const smtpHostRef = useRef<HTMLInputElement>(null)
  const smtpPortRef = useRef<HTMLInputElement>(null)
  const smtpUserRef = useRef<HTMLInputElement>(null)
  const smtpPassRef = useRef<HTMLInputElement>(null)
  const smtpFromRef = useRef<HTMLInputElement>(null)
  const t = useTranslations('settings')
  const nextIntlLocale = useLocale()
  const uiLocale: Locale = locales.includes(nextIntlLocale as Locale)
    ? (nextIntlLocale as Locale)
    : defaultLocale

  const normalizeEmail = (email: string) => email.trim().toLowerCase()

  const duplicateVendorEmailById = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of vendors) {
      const e = normalizeEmail(v.email)
      if (!e) continue
      counts.set(e, (counts.get(e) ?? 0) + 1)
    }
    const duplicates = new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([e]) => e))
    const byId: Record<string, true> = {}
    for (const v of vendors) {
      const e = normalizeEmail(v.email)
      if (e && duplicates.has(e)) byId[v.id] = true
    }
    return byId
  }, [vendors])

  const hasDuplicateVendorEmails = useMemo(
    () => Object.keys(duplicateVendorEmailById).length > 0,
    [duplicateVendorEmailById]
  )

  const duplicateMechanicEmailById = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of mechanics) {
      const e = normalizeEmail(row.email)
      if (!e) continue
      counts.set(e, (counts.get(e) ?? 0) + 1)
    }
    const duplicates = new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([e]) => e))
    const byId: Record<string, true> = {}
    for (const row of mechanics) {
      const e = normalizeEmail(row.email)
      if (e && duplicates.has(e)) byId[row.id] = true
    }
    return byId
  }, [mechanics])

  const hasDuplicateMechanicEmails = useMemo(
    () => Object.keys(duplicateMechanicEmailById).length > 0,
    [duplicateMechanicEmailById]
  )

  useEffect(() => {
    const loadSettingsBootstrap = async () => {
      const noStore = { cache: 'no-store' as const }
      let loadedVendorsFromServer = false
      let loadedMechanicsFromServer = false
      let loadedPartsRecipients = false

      const [vendorsRes, mechanicsRes, partsRes, smtpRes] = await Promise.all([
        fetch('/api/settings/vendors', noStore),
        fetch('/api/mechanics?includeInactive=1&seedDefault=1', noStore),
        fetch('/api/settings/parts-order-recipients', noStore),
        fetch('/api/settings/smtp', noStore),
      ])

      try {
        const response = vendorsRes
        if (!response.ok) throw new Error(`Failed to load vendors (${response.status})`)
        const json = (await response.json()) as {
          vendors?: Array<{
            id: string
            email: string
            display_name?: string | null
            phone?: string | null
            is_active?: boolean
          }>
          vendorProfileColumnsUnavailable?: boolean
        }
        const data = json.vendors ?? []

        if (data.length > 0) {
          loadedVendorsFromServer = true
          let next: Vendor[] = data.map((entry, index) => ({
            id: entry.id,
            name:
              typeof entry.display_name === 'string' && entry.display_name.trim().length > 0
                ? entry.display_name.trim()
                : `Vendor ${index + 1}`,
            email: (entry.email || '').trim().toLowerCase(),
            phone: typeof entry.phone === 'string' ? entry.phone : '',
            is_active: entry.is_active !== false,
          }))
          if (json.vendorProfileColumnsUnavailable) {
            try {
              const raw = localStorage.getItem('vendors')
              if (raw) {
                const local = JSON.parse(raw) as Vendor[]
                const byEmail = new Map(local.map((v) => [normalizeEmail(v.email), v]))
                next = next.map((row) => {
                  const hit = byEmail.get(row.email)
                  if (!hit) return row
                  return {
                    ...row,
                    name: hit.name?.trim() || row.name,
                    phone: typeof hit.phone === 'string' ? hit.phone : row.phone,
                    is_active: hit.is_active,
                  }
                })
              }
            } catch {
              // ignore corrupt local cache
            }
          }
          setVendors(next)
        }
      } catch (error) {
        console.error('Failed to load vendors from Supabase:', error)
      }

      if (!loadedVendorsFromServer) {
        const savedVendors = localStorage.getItem('vendors')
        if (savedVendors) {
          setVendors(JSON.parse(savedVendors))
        }
      }

      try {
        const response = mechanicsRes
        if (!response.ok) throw new Error(`Failed to load mechanics (${response.status})`)
        const json = (await response.json()) as {
          mechanics?: Array<{
            id: string
            name?: string
            english_name?: string
            email?: string
            login_code?: string | null
            is_active?: boolean
          }>
          warning?: string
        }
        const rows = Array.isArray(json.mechanics) ? json.mechanics : []
        const syntheticByWarning =
          typeof json.warning === 'string' && json.warning.trim().length > 0
        if (rows.length > 0) {
          loadedMechanicsFromServer = true
          setMechanics(
            rows.map((row) => {
              const id = typeof row.id === 'string' ? row.id : ''
              const isSyntheticRow =
                syntheticByWarning || id.startsWith('fallback-mechanic-')
              return {
                id,
                name: (
                  typeof row.english_name === 'string' && row.english_name.trim().length > 0
                    ? row.english_name
                    : row.name || ''
                ).trim(),
                email: (row.email || '').trim().toLowerCase(),
                loginCode: typeof row.login_code === 'string' ? row.login_code : '',
                is_active: row.is_active !== false,
                isNew: isSyntheticRow,
              }
            })
          )
        }
      } catch (error) {
        console.error('Failed to load mechanics from Supabase:', error)
      }

      if (!loadedMechanicsFromServer) {
        setMechanics([
          { id: 'fallback-mechanic-1', name: 'mechanicA', email: 'mechanica@fujimak.local', loginCode: '', is_active: true, isNew: true },
          { id: 'fallback-mechanic-2', name: 'mechanicB', email: 'mechanicb@fujimak.local', loginCode: '', is_active: true, isNew: true },
          { id: 'fallback-mechanic-3', name: 'mechanicC', email: 'mechanicc@fujimak.local', loginCode: '', is_active: true, isNew: true },
        ])
      }

      try {
        const response = partsRes
        if (!response.ok) throw new Error(`Failed to load parts recipients (${response.status})`)
        const json = (await response.json()) as {
          recipients?: { id: string; email: string; is_active: boolean }[]
        }
        const recipients = json.recipients ?? []
        if (recipients.length > 0) {
          const active = recipients.find((recipient) => recipient.is_active)
          setPartsOrderRecipientEmail((active?.email ?? recipients[0]?.email ?? '').trim())
          loadedPartsRecipients = true
        }
      } catch (error) {
        console.error('Failed to load parts recipients from Supabase:', error)
      }

      const savedPartsRecipients = !loadedPartsRecipients
        ? localStorage.getItem(PARTS_RECIPIENTS_STORAGE_KEY)
        : null
      if (savedPartsRecipients && !loadedPartsRecipients) {
        try {
          const parsed = JSON.parse(savedPartsRecipients) as unknown
          if (typeof parsed === 'string') {
            setPartsOrderRecipientEmail(parsed)
            loadedPartsRecipients = true
          }
          if (Array.isArray(parsed)) {
            const first = parsed.find(
              (entry) => typeof entry === 'object' && entry !== null && 'email' in entry
            ) as { email?: unknown } | undefined
            const email = typeof first?.email === 'string' ? first.email : ''
            setPartsOrderRecipientEmail(email)
            loadedPartsRecipients = true
          }
        } catch {
          // Backward compatibility for old plain string storage
          setPartsOrderRecipientEmail(savedPartsRecipients)
          loadedPartsRecipients = true
        }
      }

      if (!loadedPartsRecipients) {
        setPartsOrderRecipientEmail('')
      }

      let smtpLoadedFromServer = false
      try {
        const response = smtpRes
        if (!response.ok) throw new Error(`Failed to load SMTP settings (${response.status})`)
        const json = (await response.json()) as { smtp?: Partial<SmtpSettings> }
        const smtp = json.smtp ?? {}
        setSmtpSettings({
          host: typeof smtp.host === 'string' ? smtp.host : '',
          port: typeof smtp.port === 'string' && smtp.port.length > 0 ? smtp.port : '465',
          secure: smtp.secure !== false,
          user: typeof smtp.user === 'string' ? smtp.user : '',
          pass: typeof smtp.pass === 'string' ? smtp.pass : '',
          from: typeof smtp.from === 'string' ? smtp.from : '',
        })
        smtpLoadedFromServer = true
      } catch (error) {
        console.error('Failed to load SMTP settings from Supabase:', error)
      }

      if (smtpLoadedFromServer) {
        return
      }

      const savedSmtpSettings = localStorage.getItem(SMTP_SETTINGS_STORAGE_KEY)
      if (savedSmtpSettings) {
        try {
          const parsed = JSON.parse(savedSmtpSettings) as Partial<SmtpSettings>
          setSmtpSettings({
            host: typeof parsed.host === 'string' ? parsed.host : '',
            port: typeof parsed.port === 'string' && parsed.port.length > 0 ? parsed.port : '465',
            secure: parsed.secure !== false,
            user: typeof parsed.user === 'string' ? parsed.user : '',
            pass: typeof parsed.pass === 'string' ? parsed.pass : '',
            from: typeof parsed.from === 'string' ? parsed.from : '',
          })
        } catch {
          // ignore broken local storage
        }
      }
    }

    void loadSettingsBootstrap()
  }, [])

  const addVendor = () => {
    setSaveFeedback(null)
    const newVendor: Vendor = {
      id: Date.now().toString(),
      name: '',
      email: '',
      phone: '',
      is_active: true
    }
    setVendors([...vendors, newVendor])
  }

  const updateVendor = (id: string, field: keyof Vendor, value: string | boolean) => {
    setSaveFeedback(null)
    setVendors(vendors.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ))
  }

  const removeVendor = (id: string) => {
    setSaveFeedback(null)
    setVendors(vendors.filter(v => v.id !== id))
  }

  const addMechanic = () => {
    setSaveFeedback(null)
    const row: MechanicSetting = {
      id: `new-mechanic-${Date.now()}`,
      name: '',
      email: '',
      loginCode: '',
      is_active: true,
      isNew: true,
    }
    setMechanics((prev) => [...prev, row])
  }

  const updateMechanic = (id: string, field: keyof MechanicSetting, value: string | boolean) => {
    setSaveFeedback(null)
    setMechanics((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    )
  }

  const removeMechanic = (id: string) => {
    setSaveFeedback(null)
    setMechanics((prev) =>
      prev
        .map((row) => {
          if (row.id !== id) return row
          if (row.isNew) return null
          return { ...row, is_active: false }
        })
        .filter((row): row is MechanicSetting => row !== null)
    )
  }

  const updatePartsOrderRecipientEmail = (value: string) => {
    setSaveFeedback(null)
    setPartsOrderRecipientEmail(value)
  }

  const updateSmtpSetting = <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) => {
    setSaveFeedback(null)
    setSmtpTestFeedback(null)
    setSmtpSettings((prev) => ({ ...prev, [key]: value }))
  }

  const runSmtpTest = async () => {
    setSmtpTestFeedback(null)
    const merged: SmtpSettings = {
      host: smtpHostRef.current?.value.trim() || smtpSettings.host.trim(),
      port: smtpPortRef.current?.value.trim() || smtpSettings.port.trim() || '465',
      secure: smtpSettings.secure,
      user: smtpUserRef.current?.value.trim() || smtpSettings.user.trim(),
      pass: smtpPassRef.current?.value.trim() || smtpSettings.pass.trim(),
      from: smtpFromRef.current?.value.trim() || smtpSettings.from.trim(),
    }
    if (!merged.host || !merged.user) {
      setSmtpTestFeedback({
        type: 'error',
        explanation: {
          title: t('smtpTestMissingCredentialsTitle'),
          summary: t('smtpTestMissingCredentialsSummary'),
          actions: [],
          technical: '',
        },
      })
      return
    }
    setSmtpSettings((prev) => ({ ...prev, ...merged }))
    setIsSmtpTesting(true)
    try {
      const res = await fetch('/api/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp: {
            host: merged.host.trim(),
            port: merged.port.trim() || '465',
            secure: merged.secure !== false,
            user: merged.user.trim(),
            pass: merged.pass.trim(),
            from: merged.from.trim(),
          },
          mergeSavedPassword: true,
          testTo: smtpTestTo.trim() || undefined,
          locale: uiLocale,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        explanation?: SmtpTestExplanation
        step?: string
        message?: string
        recipient?: string
      }
      if (!res.ok || !json.ok) {
        const explanation =
          json.explanation ??
          ({
            title: t('smtpTestUnknownTitle'),
            summary: t('smtpTestUnknownSummary'),
            actions: [],
            technical: typeof json === 'object' ? JSON.stringify(json) : 'unknown',
          } satisfies SmtpTestExplanation)
        setSmtpTestFeedback({ type: 'error', explanation, step: json.step })
        return
      }
      setSmtpTestFeedback({
        type: 'success',
        message: json.message ?? t('smtpTestSuccessFallback'),
        recipient: json.recipient,
      })
    } catch {
      setSmtpTestFeedback({
        type: 'error',
        explanation: {
          title: t('smtpTestUnknownTitle'),
          summary: t('smtpTestUnknownSummary'),
          actions: [],
          technical: 'Network error',
        },
      })
    } finally {
      setIsSmtpTesting(false)
    }
  }

  const saveAllSettings = async () => {
    if (hasDuplicateVendorEmails) {
      const message = t('duplicateEmailAlert')
      setSaveFeedback({ type: 'error', message })
      alert(message)
      return
    }
    if (hasDuplicateMechanicEmails) {
      const message = 'Mechanic email has duplicates. Please fix before saving.'
      setSaveFeedback({ type: 'error', message })
      alert(message)
      return
    }
    setSaveFeedback(null)
    setIsSaving(true)
    try {
      // Save to localStorage（メールは正規化して保存）
      const cleaned = vendors.map((v) => ({ ...v, email: normalizeEmail(v.email) }))
      localStorage.setItem('vendors', JSON.stringify(cleaned))
      setVendors(cleaned)

      const vendorsPayload = cleaned
        .filter((vendor) => vendor.email.trim().length > 0)
        .map((vendor) => ({
          email: normalizeEmail(vendor.email),
          name: vendor.name.trim(),
          phone: vendor.phone.trim(),
          is_active: vendor.is_active,
        }))

      const activeEmails = cleaned
        .filter((vendor) => vendor.is_active && vendor.email.trim().length > 0)
        .map((vendor) => normalizeEmail(vendor.email))

      const vendorResponse = await fetch('/api/settings/vendors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendors: vendorsPayload }),
      })
      const vendorJson = (await vendorResponse.json().catch(() => ({}))) as {
        error?: string
        vendorProfilePersistSkipped?: boolean
      }
      if (!vendorResponse.ok) {
        throw new Error(vendorJson.error || `Failed to save vendors (${vendorResponse.status})`)
      }

      const reloadVendorsRes = await fetch('/api/settings/vendors', { cache: 'no-store' })
      if (reloadVendorsRes.ok) {
        const reloadJson = (await reloadVendorsRes.json()) as {
          vendors?: Array<{
            id: string
            email: string
            display_name?: string | null
            phone?: string | null
            is_active?: boolean
          }>
          vendorProfileColumnsUnavailable?: boolean
        }
        const vRows = reloadJson.vendors ?? []
        const profileSkipped =
          vendorJson.vendorProfilePersistSkipped === true ||
          reloadJson.vendorProfileColumnsUnavailable === true
        const remapped = vRows.map((entry, index) => ({
          id: entry.id,
          name:
            typeof entry.display_name === 'string' && entry.display_name.trim().length > 0
              ? entry.display_name.trim()
              : `Vendor ${index + 1}`,
          email: (entry.email || '').trim().toLowerCase(),
          phone: typeof entry.phone === 'string' ? entry.phone : '',
          is_active: entry.is_active !== false,
        }))
        const merged = profileSkipped
          ? remapped.map((row) => {
              const hit = cleaned.find((c) => normalizeEmail(c.email) === row.email)
              return hit
                ? {
                    ...row,
                    name: hit.name,
                    phone: hit.phone,
                    is_active: hit.is_active,
                  }
                : row
            })
          : remapped
        setVendors(merged)
        localStorage.setItem('vendors', JSON.stringify(merged))
      }

      const normalizedPartsRecipientEmail = normalizeEmail(partsOrderRecipientEmail)
      localStorage.setItem(PARTS_RECIPIENTS_STORAGE_KEY, JSON.stringify(normalizedPartsRecipientEmail))
      setPartsOrderRecipientEmail(normalizedPartsRecipientEmail)
      const partsRecipientsPayload = normalizedPartsRecipientEmail
        ? [{ email: normalizedPartsRecipientEmail, is_active: true }]
        : []
      const partsResponse = await fetch('/api/settings/parts-order-recipients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: partsRecipientsPayload }),
      })
      if (!partsResponse.ok) {
        const json = (await partsResponse.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || `Failed to save parts recipients (${partsResponse.status})`)
      }

      const normalizedSmtpSettings: SmtpSettings = {
        host: smtpSettings.host.trim(),
        port: smtpSettings.port.trim() || '465',
        secure: smtpSettings.secure !== false,
        user: smtpSettings.user.trim(),
        pass: smtpSettings.pass.trim(),
        from: smtpSettings.from.trim(),
      }
      localStorage.setItem(SMTP_SETTINGS_STORAGE_KEY, JSON.stringify(normalizedSmtpSettings))
      setSmtpSettings(normalizedSmtpSettings)
      const smtpResponse = await fetch('/api/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtp: normalizedSmtpSettings }),
      })
      if (!smtpResponse.ok) {
        const json = (await smtpResponse.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || `Failed to save SMTP settings (${smtpResponse.status})`)
      }

      const normalizedMechanics = mechanics.map((row) => ({
        ...row,
        name: row.name.trim(),
        email: normalizeEmail(row.email),
        loginCode: row.loginCode.trim(),
      }))

      const activeMechanics = normalizedMechanics.filter((row) => row.is_active)
      if (activeMechanics.length === 0) {
        throw new Error('At least one active mechanic is required.')
      }

      for (const row of normalizedMechanics) {
        if (!row.name || !row.email) {
          throw new Error('Mechanic name and email are required.')
        }
      }

      let mechanicsTableUnavailable = false
      for (const row of normalizedMechanics) {
        if (row.isNew) {
          const createRes = await fetch('/api/mechanics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              englishName: row.name,
              emailAddress: row.email,
              loginCode: row.loginCode,
              isActive: row.is_active,
            }),
          })
          if (!createRes.ok) {
            const json = (await createRes.json().catch(() => ({}))) as {
              error?: string
              code?: string
            }
            if (createRes.status === 503 && json.code === 'MECHANICS_TABLE_UNAVAILABLE') {
              mechanicsTableUnavailable = true
              break
            }
            throw new Error(json.error || `Failed to create mechanic (${createRes.status})`)
          }
          continue
        }

        const updateRes = await fetch('/api/mechanics', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: row.id,
            englishName: row.name,
            emailAddress: row.email,
            loginCode: row.loginCode,
            isActive: row.is_active,
          }),
        })
        if (!updateRes.ok) {
          const json = (await updateRes.json().catch(() => ({}))) as {
            error?: string
            code?: string
          }
          if (updateRes.status === 503 && json.code === 'MECHANICS_TABLE_UNAVAILABLE') {
            mechanicsTableUnavailable = true
            break
          }
          throw new Error(json.error || `Failed to update mechanic (${updateRes.status})`)
        }
      }

      if (mechanicsTableUnavailable) {
        setSaveFeedback({
          type: 'success',
          message:
            'Saved vendors, parts recipients, and SMTP. Mechanic profiles were not synced because the database table mechanics does not exist yet. Run Supabase migration 20260330000200_mechanic_assignment_board.sql (supabase/migrations), then save again to sync mechanics.',
        })
      } else {
        const mechanicsReloadRes = await fetch('/api/mechanics?includeInactive=1&seedDefault=1', { cache: 'no-store' })
        if (mechanicsReloadRes.ok) {
          const mechanicsJson = (await mechanicsReloadRes.json()) as {
            mechanics?: Array<{
              id: string
              name?: string
              english_name?: string
              email?: string
              login_code?: string | null
              is_active?: boolean
            }>
          }
          const rows = Array.isArray(mechanicsJson.mechanics) ? mechanicsJson.mechanics : []
          setMechanics(
            rows.map((row) => ({
              id: row.id,
              name: (typeof row.english_name === 'string' && row.english_name.trim().length > 0
                ? row.english_name
                : row.name || ''
              ).trim(),
              email: (row.email || '').trim().toLowerCase(),
              loginCode: typeof row.login_code === 'string' ? row.login_code : '',
              is_active: row.is_active !== false,
              isNew: false,
            }))
          )
        }

        setSaveFeedback({
          type: 'success',
          message: `Saved (vendors: ${activeEmails.length}, mechanics: ${activeMechanics.length}/${normalizedMechanics.length}, parts recipients: ${partsRecipientsPayload.length}, smtp: ${normalizedSmtpSettings.user ? 'configured' : 'empty'})`,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save settings'
      setSaveFeedback({
        type: 'error',
        message,
      })
      alert(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header showBack title={t('title')} />
      
      <main className="px-4 py-6 space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
            style={{ minHeight: '48px' }}
          >
            <LogOut className="h-5 w-5" />
            {t('logout')}
          </button>
        </section>

        {/* Language Setting */}
        <section className="bg-white rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('language')}
          </h2>
          <LanguageSwitcher currentLocale={uiLocale} />
        </section>

        {/* Vendor Settings */}
        <section className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('vendors')}
            </h2>
            <button
              onClick={addVendor}
              className="flex items-center gap-2 text-zinc-900 text-base font-medium px-4 py-3 bg-zinc-100 rounded-lg"
            >
              <Plus className="w-5 h-5" />
              {t('addVendor')}
            </button>
          </div>

          <div className="space-y-4">
            {vendors.map((vendor, index) => (
              <div 
                key={vendor.id}
                className="p-4 bg-gray-50 rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    {t('vendorIndexLabel', { index: index + 1 })}
                  </span>
                  <button
                    onClick={() => removeVendor(vendor.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-500 mb-2">
                    {t('vendorName')}
                  </label>
                  <input
                    type="text"
                    value={vendor.name}
                    onChange={(e) => updateVendor(vendor.id, 'name', e.target.value)}
                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                    placeholder={t('vendorNamePlaceholder')}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-500 mb-2">
                    {t('vendorEmail')}
                  </label>
                  <input
                    type="email"
                    value={vendor.email}
                    onChange={(e) => updateVendor(vendor.id, 'email', e.target.value)}
                    className={`w-full px-4 py-4 bg-white border rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${
                      duplicateVendorEmailById[vendor.id] ? 'border-red-400' : 'border-gray-200'
                    }`}
                    placeholder="example@email.com"
                  />
                  {duplicateVendorEmailById[vendor.id] && (
                    <p className="text-sm text-red-600 mt-2">
                      {t('duplicateEmailInline')}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm text-gray-500 mb-2">
                    {t('vendorPhone')}
                  </label>
                  <input
                    type="tel"
                    value={vendor.phone}
                    onChange={(e) => updateVendor(vendor.id, 'phone', e.target.value)}
                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                    placeholder={t('vendorPhonePlaceholder')}
                  />
                </div>

                <div className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    id={`active-${vendor.id}`}
                    checked={vendor.is_active}
                    onChange={(e) => updateVendor(vendor.id, 'is_active', e.target.checked)}
                    className="w-6 h-6 text-zinc-900 rounded"
                  />
                  <label htmlFor={`active-${vendor.id}`} className="text-base text-gray-600">
                    {t('active')}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Mechanic Settings */}
        <section className="bg-white rounded-xl p-4">
          <div className="mb-2">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Mechanic Settings
            </h2>
          </div>

          <p className="mb-3 text-xs text-gray-500">
            Configure mechanic names (A/B/C) and add more mechanics here.
            Active: {mechanics.filter((row) => row.is_active).length} / {mechanics.length}
          </p>

          <button
            onClick={addMechanic}
            className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3 text-base font-medium text-zinc-900"
          >
            <Plus className="w-5 h-5" />
            Add Mechanic
          </button>

          <div className="space-y-4">
            {mechanics.map((row, index) => (
              <div key={row.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Mechanic {index + 1}</span>
                  <button
                    onClick={() => removeMechanic(row.id)}
                    className="text-red-500 hover:text-red-600"
                    type="button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-2">Name</label>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateMechanic(row.id, 'name', e.target.value)}
                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                    placeholder="mechanicA"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-2">Email</label>
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => updateMechanic(row.id, 'email', e.target.value)}
                    className={`w-full px-4 py-4 bg-white border rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent ${
                      duplicateMechanicEmailById[row.id] ? 'border-red-400' : 'border-gray-200'
                    }`}
                    placeholder="mechanic@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-2">Login Code (optional)</label>
                  <input
                    type="text"
                    value={row.loginCode}
                    onChange={(e) => updateMechanic(row.id, 'loginCode', e.target.value)}
                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                    placeholder="1234"
                  />
                </div>

                <div className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    id={`mechanic-active-${row.id}`}
                    checked={row.is_active}
                    onChange={(e) => updateMechanic(row.id, 'is_active', e.target.checked)}
                    className="w-6 h-6 text-zinc-900 rounded"
                  />
                  <label htmlFor={`mechanic-active-${row.id}`} className="text-base text-gray-600">
                    Active
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Parts Order Recipient Settings */}
        <section className="bg-white rounded-xl p-4">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('partsOrderRecipients')}
            </h2>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-600">Mail1</label>
            <input
              type="email"
              value={partsOrderRecipientEmail}
              onChange={(e) => updatePartsOrderRecipientEmail(e.target.value)}
              className="w-full mt-2 px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              placeholder={t('partsRecipientEmailPlaceholder')}
            />
          </div>
        </section>

        {/* SMTP Settings */}
        <section className="bg-white rounded-xl p-4">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              SMTP Settings
            </h2>
          </div>
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-600">SMTP Host</label>
              <input
                ref={smtpHostRef}
                type="text"
                value={smtpSettings.host}
                onChange={(e) => updateSmtpSetting('host', e.target.value)}
                onInput={(e) => updateSmtpSetting('host', (e.target as HTMLInputElement).value)}
                autoComplete="off"
                className="w-full mt-2 px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">SMTP Port</label>
              <input
                ref={smtpPortRef}
                type="text"
                value={smtpSettings.port}
                onChange={(e) => updateSmtpSetting('port', e.target.value)}
                onInput={(e) => updateSmtpSetting('port', (e.target as HTMLInputElement).value)}
                autoComplete="off"
                className="w-full mt-2 px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                placeholder="465"
              />
            </div>
            <div className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                id="smtp-secure"
                checked={smtpSettings.secure}
                onChange={(e) => updateSmtpSetting('secure', e.target.checked)}
                className="w-5 h-5 text-zinc-900 rounded"
              />
              <label htmlFor="smtp-secure" className="text-sm text-gray-700">
                Use secure connection (SSL/TLS)
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">SMTP User</label>
              <input
                ref={smtpUserRef}
                type="text"
                value={smtpSettings.user}
                onChange={(e) => updateSmtpSetting('user', e.target.value)}
                onInput={(e) => updateSmtpSetting('user', (e.target as HTMLInputElement).value)}
                autoComplete="username"
                className="w-full mt-2 px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                placeholder="youraccount@gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">SMTP Password</label>
              <input
                ref={smtpPassRef}
                type="password"
                value={smtpSettings.pass}
                onChange={(e) => updateSmtpSetting('pass', e.target.value)}
                onInput={(e) => updateSmtpSetting('pass', (e.target as HTMLInputElement).value)}
                autoComplete="current-password"
                className="w-full mt-2 px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                placeholder=""
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">From Address</label>
              <input
                ref={smtpFromRef}
                type="text"
                value={smtpSettings.from}
                onChange={(e) => updateSmtpSetting('from', e.target.value)}
                onInput={(e) => updateSmtpSetting('from', (e.target as HTMLInputElement).value)}
                autoComplete="off"
                className="w-full mt-2 px-4 py-4 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                placeholder="Fujimak Maintenance <youraccount@gmail.com>"
              />
            </div>
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-3">
              <label className="block text-sm font-medium text-gray-700">{t('smtpTestToLabel')}</label>
              <input
                type="email"
                value={smtpTestTo}
                onChange={(e) => setSmtpTestTo(e.target.value)}
                className="w-full mt-2 px-4 py-3 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                placeholder={smtpSettings.user.trim() || 'recipient@example.com'}
              />
              <p className="mt-1 text-xs text-gray-500">{t('smtpTestToHint')}</p>
            </div>
          </div>
        </section>

        <div className="flex w-full max-w-xl mx-auto flex-col gap-3 px-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={saveAllSettings}
            disabled={
              isSaving ||
              isSmtpTesting ||
              hasDuplicateVendorEmails ||
              hasDuplicateMechanicEmails
            }
            className="flex flex-1 min-h-[52px] items-center justify-center gap-2 rounded-xl bg-zinc-900 py-4 text-lg font-medium text-white disabled:opacity-50"
          >
            {isSaving ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Save className="h-6 w-6" />
                {t('save')}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void runSmtpTest()}
            disabled={
              isSmtpTesting ||
              isSaving ||
              hasDuplicateVendorEmails ||
              hasDuplicateMechanicEmails
            }
            className="flex flex-1 min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-zinc-900 bg-white py-4 text-lg font-medium text-zinc-900 disabled:opacity-50"
          >
            {isSmtpTesting ? (
              <>
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
                <span>{t('smtpTesting')}</span>
              </>
            ) : (
              <>
                <Send className="h-6 w-6" />
                {t('smtpSendTest')}
              </>
            )}
          </button>
        </div>
        {smtpTestFeedback?.type === 'success' ? (
          <div className="mx-auto mt-3 max-w-xl rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <p className="font-semibold">{smtpTestFeedback.message}</p>
            {smtpTestFeedback.recipient ? (
              <p className="mt-1 text-xs text-emerald-800">{smtpTestFeedback.recipient}</p>
            ) : null}
          </div>
        ) : null}
        {smtpTestFeedback?.type === 'error' ? (
          <div className="mx-auto mt-3 max-w-xl rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-950">
            <p className="font-semibold text-red-900">{smtpTestFeedback.explanation.title}</p>
            {smtpTestFeedback.step ? (
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-red-700">
                step: {smtpTestFeedback.step}
              </p>
            ) : null}
            <p className="mt-2 text-red-900">{smtpTestFeedback.explanation.summary}</p>
            {smtpTestFeedback.explanation.actions.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-red-900">
                {smtpTestFeedback.explanation.actions.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            ) : null}
            <details className="mt-3 text-xs text-red-800">
              <summary className="cursor-pointer font-medium">{t('smtpTestTechnicalSummary')}</summary>
              <pre className="mt-2 whitespace-pre-wrap break-all font-mono">{smtpTestFeedback.explanation.technical}</pre>
            </details>
          </div>
        ) : null}

        {saveFeedback ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              saveFeedback.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {saveFeedback.message}
          </p>
        ) : null}

        {/* Version Info */}
        <div className="text-center text-sm text-gray-400">
          <p>{t('version')}: 1.0.0</p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
