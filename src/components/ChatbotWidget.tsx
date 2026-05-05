'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, Mic, Send, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

const CHATBOT_GIF_SRC = '/images/chatbot-support.gif?v=20260328_1746'

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  attachments?: ChatAttachment[]
  hideContentWhenAttachment?: boolean
}

type ChatAttachment = {
  url: string
  source: 'image' | 'video'
  mimeType: string
  name: string
}

type UserProfile = {
  surname?: string
  phone?: string
  surnameConfirmed?: boolean
}

type Extracted = {
  urgency?: 'urgent' | 'normal'
  contact?: { method?: 'phone' | 'email' | 'none'; phone?: string; email?: string }
  summary?: string
}

type ChatApiResponse = {
  threadId: string
  assistantMessage: string
  extracted?: Extracted
}

type OutgoingMedia = {
  // What we send to backend/LLM.
  mimeType: string
  data: string // base64 (no data: prefix)
  previewUrl: string
  playbackUrl?: string
  displayMimeType: string
  name: string
  source: 'image' | 'video'
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

async function optimizeImageToDataUrl(file: File) {
  const maxLongSide = 1280
  const jpegQuality = 0.72

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load selected image'))
      img.src = objectUrl
    })

    const ratio = Math.min(1, maxLongSide / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * ratio))
    const height = Math.max(1, Math.round(image.height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to prepare image canvas')
    ctx.drawImage(image, 0, 0, width, height)

    return canvas.toDataURL('image/jpeg', jpegQuality)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function initialMessages(locale: string): ChatMessage[] {
  return [
    {
      id: `welcome_${locale}`,
      role: 'assistant',
      content:
        locale === 'en'
          ? 'Hello. To start, please tell me your last name (surname only is OK).'
          : locale === 'tl'
            ? 'Kumusta. Para makapagsimula, pakisabi ang apelyido mo (apelyido lang ay okay na).'
          : locale === 'ja'
            ? 'こんにちは。最初にフォローのため「苗字」を教えてください（苗字だけでOK）'
            : '你好。開始前請先提供「姓氏」（只需姓氏即可），方便後續跟進。',
    },
  ]
}

export default function ChatbotWidget({
  storeId,
  storeName,
  locale,
  launcherPlacement = 'fixed',
  renderMode = 'launcher',
}: {
  storeId: string
  storeName: string
  locale: string
  launcherPlacement?: 'fixed' | 'embedded'
  renderMode?: 'launcher' | 'page'
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [images, setImages] = useState<OutgoingMedia[]>([])
  const [profile, setProfile] = useState<UserProfile>({})
  const pendingIssueRef = useRef<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages(locale))
  const [isMounted, setIsMounted] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const isEmbedded = launcherPlacement === 'embedded'
  const isPageMode = renderMode === 'page'

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, isOpen])

  const keepLatestInView = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    })
  }

  useEffect(() => {
    if (!isOpen || isPageMode) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, isPageMode])

  const launcherLabel =
    locale === 'en' ? 'AI Support' : locale === 'tl' ? 'AI Support' : locale === 'ja' ? 'AIサポート' : 'AI支援'

  const renderRichText = (content: string) => {
    // Minimal markdown: render **bold** safely (no HTML).
    const s = typeof content === 'string' ? content : ''
    const nodes: React.ReactNode[] = []
    let i = 0
    let k = 0

    while (i < s.length) {
      const start = s.indexOf('**', i)
      if (start === -1) {
        nodes.push(<span key={`t_${k++}`}>{s.slice(i)}</span>)
        break
      }

      const end = s.indexOf('**', start + 2)
      if (end === -1) {
        // unmatched -> keep as plain text
        nodes.push(<span key={`t_${k++}`}>{s.slice(i)}</span>)
        break
      }

      if (start > i) nodes.push(<span key={`t_${k++}`}>{s.slice(i, start)}</span>)
      nodes.push(<strong key={`b_${k++}`}>{s.slice(start + 2, end)}</strong>)
      i = end + 2
    }

    return nodes
  }

  const formatName = (surname?: string) => {
    const s = (surname ?? '').trim()
    if (!s) return ''
    if (locale === 'ja') return `${s}さん`
    if (locale === 'en' || locale === 'tl') return s
    // zh-HK (Cantonese UI)
    return `${s}先生`
  }

  const prefixWithName = (text: string, surname?: string) => {
    const base = typeof text === 'string' ? text.trim() : ''
    const name = formatName(surname)
    if (!name || !base) return base

    // Avoid double-prefixing if model already did it.
    if (base.startsWith(name)) return base
    if (base.startsWith(`${name}，`)) return base
    if (base.startsWith(`${name},`)) return base
    if (base.startsWith(`${name} `)) return base

    const sep = locale === 'en' || locale === 'tl' ? ', ' : '，'
    return `${name}${sep}${base}`
  }

  const isYes = (raw: string) => {
    const s = raw.trim().toLowerCase()
    if (!s) return false
    if (locale === 'ja') return ['はい', 'うん', 'ok', 'okay', '大丈夫', '合ってます', 'あってます', 'そうです'].some((k) => s.includes(k))
    if (locale === 'en') return ['yes', 'yep', 'ok', 'okay', 'correct', 'right'].some((k) => s === k || s.includes(k))
    if (locale === 'tl') return ['oo', 'opo', 'yes', 'ok', 'okay', 'tama', 'sige'].some((k) => s === k || s.includes(k))
    // zh-HK
    return ['係', '係呀', '啱', '啱呀', '好', '可以', 'ok', 'okay', 'yes', '對', '正确', '正確'].some((k) => raw.includes(k))
  }

  const isNo = (raw: string) => {
    const s = raw.trim().toLowerCase()
    if (!s) return false
    if (locale === 'ja') return ['いいえ', '違う', 'ちがう', '違います', 'ちがいます', '違うよ'].some((k) => s.includes(k))
    if (locale === 'en') return ['no', 'nope', 'wrong', 'incorrect'].some((k) => s === k || s.includes(k))
    if (locale === 'tl') return ['hindi', 'hindi po', 'no', 'mali', 'ayaw'].some((k) => s === k || s.includes(k))
    // zh-HK
    return ['唔係', '不是', '唔啱', '唔對', '錯', '唔正確', 'no', 'wrong'].some((k) => raw.includes(k) || s.includes(k))
  }

  const pickSurnameCandidate = (raw: string): string | null => {
    const s0 = raw.trim()
    if (!s0) return null
    const compact = s0.replace(/\s+/g, '')
    const lowerCompact = compact.toLowerCase()

    // reject common greeting / testing phrases
    const rejectCjk =
      locale === 'ja'
        ? ['もしもし', 'こんにちは', 'こんばんは', '聞こえ', 'テスト', '聞こえますか']
        : ['喂', '餵', '你好', '聽唔聽到', '听唔听到', '聽到', '听到', '測試', '测试', '哈囉', '哈罗']
    const rejectRoman = ['hello', 'hi', 'hey', 'test', 'ok', 'okay', 'can you hear me']
    for (const r of rejectCjk) {
      if (!r) continue
      if (compact.includes(r)) return null
    }
    for (const r of rejectRoman) {
      if (!r) continue
      if (lowerCompact.includes(r)) return null
    }

    // Accept patterns like "李先生" / "佐近さん"
    const honorificMatch = compact.match(/^([\u4E00-\u9FFF]{1,6})(先生|小姐|女士|太太|さん|君|様)$/)
    if (honorificMatch?.[1]) {
      const picked = honorificMatch[1].replace(/[^\u4E00-\u9FFF]/g, '')
      if (picked) return picked.slice(0, Math.min(2, picked.length))
    }

    // CJK surname: be conservative (1-2 chars, and input must be short)
    const cjkOnly = compact.replace(/[^\u4E00-\u9FFF]/g, '')
    if (cjkOnly.length >= 1 && cjkOnly.length <= 2 && compact.length <= 6) return cjkOnly

    // Roman surname: allow even in ja/zh (sometimes user types English name)
    // Be conservative: accept 1 token like "Smith", or "Mr Smith" / "S. Smith".
    if (/[0-9]/.test(compact)) return null
    if (/[\u4E00-\u9FFF]/.test(compact)) return null

    const cleaned = s0.replace(/[，。、．,.!?:;（）()［\]【】「」『』"“”]/g, ' ').trim()
    const tokens = cleaned.split(/\s+/g).filter(Boolean)
    if (tokens.length === 0 || tokens.length > 2) return null

    const isNameToken = (t: string) => /^[A-Za-z][A-Za-z'’-]{0,19}$/.test(t)
    const normalizeToken = (t: string) => t.replace(/^[^A-Za-z]+|[^A-Za-z'’-]+$/g, '')

    if (tokens.length === 1) {
      const t = normalizeToken(tokens[0] ?? '')
      if (!isNameToken(t)) return null
      const lower = t.toLowerCase()
      if (rejectRoman.includes(lower)) return null
      return t
    }

    const t0Raw = normalizeToken(tokens[0] ?? '')
    const t1Raw = normalizeToken(tokens[1] ?? '')
    const honorific = /^(mr|ms|mrs|dr)\.?$/i.test(t0Raw)
    const initial = /^[A-Za-z]\.?$/.test(t0Raw)
    if (!(honorific || initial)) return null
    if (!isNameToken(t1Raw)) return null
    const lower = t1Raw.toLowerCase()
    if (rejectRoman.includes(lower)) return null
    return t1Raw
  }

  const speechRef = useRef<any>(null)
  const speechBaseInputRef = useRef<string>('')
  const isListeningRef = useRef(false)
  const lastPointerTypeRef = useRef<'mouse' | 'touch' | 'pen' | 'unknown'>('unknown')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const getSpeechLang = () => {
    // app locale: zh (繁中=香港) / en / ja
    if (locale === 'ja') return 'ja-JP'
    if (locale === 'en') return 'en-US'
    if (locale === 'tl') return 'fil-PH'
    // Cantonese is commonly exposed as zh-HK in browsers
    return 'zh-HK'
  }

  const stopListening = () => {
    try {
      speechRef.current?.stop?.()
    } catch {
      // ignore
    } finally {
      isListeningRef.current = false
      setIsListening(false)
    }
  }

  useEffect(() => {
    // cleanup on unmount
    return () => stopListening()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMicPress = () => {
    if (isListening) {
      stopListening()
      return
    }

    const SpeechRecognitionCtor =
      (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content:
            locale === 'en'
              ? 'Voice input is not supported in this browser. Please use keyboard input.'
              : locale === 'tl'
                ? 'Hindi suportado ang voice input sa browser na ito. Pakigamit ang keyboard.'
              : locale === 'ja'
                ? 'このブラウザでは音声入力が利用できません。キーボード入力をご利用ください。'
                : '此瀏覽器不支援語音輸入，請使用鍵盤輸入。',
        },
      ])
      return
    }

    speechBaseInputRef.current = input.trim().length > 0 ? `${input.trim()} ` : ''

    const rec = speechRef.current ?? new SpeechRecognitionCtor()
    speechRef.current = rec

    rec.lang = getSpeechLang()
    rec.interimResults = true
    // PCだと onend で途切れやすいので、できるだけ継続
    rec.continuous = true
    rec.maxAlternatives = 1

    rec.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0]?.transcript ?? ''
      }
      const next = `${speechBaseInputRef.current}${transcript.trim()}`
      setInput(next)
    }

    rec.onerror = () => {
      setIsListening(false)
    }

    rec.onend = () => {
      // 自動停止した場合も、ユーザーが停止していなければ再開
      if (isListeningRef.current) {
        try {
          rec.start()
          return
        } catch {
          // fallthrough
        }
      }
      setIsListening(false)
      isListeningRef.current = false
    }

    try {
      setIsListening(true)
      isListeningRef.current = true
      rec.start()
    } catch {
      setIsListening(false)
      isListeningRef.current = false
    }
  }

  const handleMicHoldStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    lastPointerTypeRef.current = (e.pointerType as any) || 'unknown'
    // Touch: press-and-hold starts recording.
    // Mouse/Pen: do nothing here (click toggles).
    if (e.pointerType === 'touch' && !isListening) handleMicPress()
  }

  const handleMicHoldEnd = () => {
    // Touch: release stops recording. Mouse/Pen: do nothing.
    if (lastPointerTypeRef.current === 'touch' && isListening) stopListening()
  }

  const addMedia = async (file: File) => {
    const isVideo = file.type.startsWith('video/')
    const toBase64 = async (targetFile: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('read_failed'))
        reader.onload = () => {
          const r = reader.result
          if (typeof r !== 'string') return reject(new Error('read_failed'))
          const idx = r.indexOf('base64,')
          if (idx < 0) return reject(new Error('read_failed'))
          resolve(r.slice(idx + 'base64,'.length))
        }
        reader.readAsDataURL(targetFile)
      })

    // Keep upload size controlled to avoid request-time failures.
    const maxImageBytes = 25 * 1024 * 1024
    const maxVideoBytes = 40 * 1024 * 1024

    if (!isVideo && file.size > maxImageBytes) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content:
            locale === 'en'
              ? 'Image is too large (max 4MB). Please send a smaller image.'
              : locale === 'tl'
                ? 'Masyadong malaki ang larawan (max 4MB). Mangyaring magpadala ng mas maliit na larawan.'
              : locale === 'ja'
                ? '画像が大きすぎます（最大4MB）。小さい画像で送ってください。'
                : '圖片太大（最大4MB）。請傳較小的圖片。',
        },
      ])
      return
    }

    if (isVideo && file.size > maxVideoBytes) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content:
            locale === 'en'
              ? 'Video is too large (max 40MB). Please send a shorter video or a photo.'
              : locale === 'tl'
                ? 'Masyadong malaki ang video (max 40MB). Mangyaring magpadala ng mas maikling video o larawan.'
              : locale === 'ja'
                ? '動画が大きすぎます（最大40MB）。短い動画か写真で送ってください。'
                : '影片太大（最大40MB）。請傳較短影片或照片。',
        },
      ])
      return
    }

    if (!isVideo) {
      // Same strategy as maintenance form: resize + compress before sending.
      const optimizedDataUrl = await optimizeImageToDataUrl(file)
      const marker = 'base64,'
      const idx = optimizedDataUrl.indexOf(marker)
      if (idx < 0) throw new Error('image_convert_failed')
      const base64 = optimizedDataUrl.slice(idx + marker.length)

      setImages((prev) => [
        ...prev,
        {
          mimeType: 'image/jpeg',
          data: base64,
          previewUrl: optimizedDataUrl,
          displayMimeType: 'image/jpeg',
          name: file.name,
          source: 'image',
        },
      ])
      return
    }

    // Video: keep the original file for backend upload and in-chat playback.
    const playbackUrl = URL.createObjectURL(file)
    const base64 = await toBase64(file)

    setImages((prev) => [
      ...prev,
      {
        mimeType: file.type || 'video/mp4',
        data: base64,
        previewUrl: playbackUrl,
        playbackUrl,
        displayMimeType: file.type || 'video/mp4',
        name: file.name,
        source: 'video',
      },
    ])
  }

  const persistProfile = (next: UserProfile) => {
    setProfile(next)
  }

  const resetConversation = () => {
    pendingIssueRef.current = ''
    setThreadId(null)
    setProfile({})
    setMessages(initialMessages(locale))
    clearImages()
    stopListening()
  }

  const startNewConversation = () => {
    // Assume a different staff member every time.
    // Do NOT reuse previous profile/thread from the same device.
    try {
      localStorage.removeItem(`support_thread:${storeId}`)
      localStorage.removeItem(`support_profile:${storeId}`)
    } catch {
      // ignore
    }
    resetConversation()
    setIsOpen(true)
  }

  const normalizePhone = (raw: string) => {
    // Philippines mobile number rules:
    // - Local: 09XXXXXXXXX (11 digits)
    // - International: +63 9XXXXXXXXX (or 639XXXXXXXXX)
    const digits = raw.replace(/[^\d]/g, '')
    let normalized = digits

    if (normalized.startsWith('00')) normalized = normalized.slice(2)
    if (normalized.startsWith('63')) normalized = normalized.slice(2)
    if (normalized.startsWith('0')) normalized = normalized.slice(1)

    if (!/^9\d{9}$/.test(normalized)) return null

    return `0${normalized}`
  }

  const extractSurname = (raw: string) => {
    const s = raw.trim()
    if (!s) return null
    const compact = s.replace(/\s+/g, '')
    const honorificMatch = compact.match(/^([\u4E00-\u9FFF]{1,6})(先生|小姐|女士|太太|さん|君|様)/)
    if (honorificMatch?.[1]) {
      const picked = honorificMatch[1].replace(/[^\u4E00-\u9FFF]/g, '')
      if (picked) return picked.slice(0, Math.min(2, picked.length))
    }
    const cjk = s.replace(/[^\u4E00-\u9FFF]/g, '')
    if (cjk.length > 0) return cjk.slice(0, Math.min(2, cjk.length))
    const m = s.match(/[A-Za-z]{2,}/)
    return m ? m[0] : null
  }

  const promptSurname = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content:
          locale === 'en'
            ? 'What is your last name? (Surname only is OK)'
            : locale === 'tl'
              ? 'Ano ang apelyido mo? (Apelyido lang ay okay na)'
            : locale === 'ja'
              ? 'まず苗字を教えてください（苗字だけでOK）'
              : '請問你的姓氏是？（只需姓氏即可）',
      },
    ])
  }

  const promptConfirmSurname = (surname: string) => {
    const name = formatName(surname)
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content:
          locale === 'en'
            ? `Just to confirm — is your last name "${surname}"? (yes/no)`
            : locale === 'tl'
              ? `Pakikumpirma lang — apelyido mo ba ay "${surname}"? (oo/hindi)`
            : locale === 'ja'
              ? `確認です。苗字は「${surname}」でよろしいですか？（はい / いいえ）`
              : `確認一下：你姓氏係「${name}」係咪？（係 / 唔係）`,
      },
    ])
  }

  const promptPhone = (surname?: string) => {
    const name = formatName(surname)
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content:
          locale === 'en'
            ? `Thanks${surname ? `, ${surname}` : ''}. What is your mobile number?`
            : locale === 'tl'
              ? `Salamat${surname ? `, ${surname}` : ''}. Ano ang mobile number mo?`
            : locale === 'ja'
              ? `ありがとうございます${surname ? `、${name}` : ''}。携帯番号を教えてください`
              : `多謝${surname ? `，${name}` : ''}。請提供手機號碼`,
      },
    ])
  }

  const promptInvalidPhone = (surname?: string) => {
    const name = formatName(surname)
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content:
          locale === 'en'
            ? `${name ? `${name}, ` : ''}that does not look like a Philippine mobile number. Please enter a valid PH mobile number (e.g. 09171234567 or +639171234567).`
            : locale === 'tl'
              ? `${name ? `${name}, ` : ''}mukhang hindi ito Philippine mobile number. Pakilagay ang tamang PH mobile number (hal. 09171234567 o +639171234567).`
              : locale === 'ja'
                ? `${name ? `${name}、` : ''}それはフィリピンのモバイル番号ではない可能性があります。正しい番号を入力してください（例: 09171234567 / +639171234567）。`
                : `${name ? `${name}，` : ''}這看起來不是菲律賓手機號碼。請輸入正確的 PH 手機號碼（例如：09171234567 或 +639171234567）。`,
      },
    ])
  }

  const promptConfirmProfileAndAskIssue = (next: UserProfile) => {
    const name = formatName(next.surname)
    const phone = next.phone ?? ''
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content:
          locale === 'en'
            ? `${name ? `Thanks, ${name}. ` : 'Thanks. '}Your mobile number ${phone} is noted. What issue are you having?`
            : locale === 'tl'
              ? `${name ? `Salamat, ${name}. ` : 'Salamat. '}Naitala na ang mobile number mo na ${phone}. Ano ang problemang nararanasan mo?`
            : locale === 'ja'
              ? `${name ? `ありがとうございます、${name}。` : 'ありがとうございます。'}携帯番号${phone}で承知しました。どのような問題でしょうか？`
              : `${name ? `多謝，${name}。` : '多謝。'}我已記錄手機號碼 ${phone}。你而家遇到咩問題？`,
      },
    ])
  }

  const promptMediaContext = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content:
          locale === 'en'
            ? 'I received the photo/video. Which part is this, and where in the store is it?'
            : locale === 'tl'
              ? 'Natanggap ko ang larawan/video. Anong bahagi ito at saan ito sa tindahan?'
            : locale === 'ja'
              ? '写真/動画を受け取りました。これは「どこの何の部分」か教えてください（例：厨房のエアコン、配膳間の水漏れ など）'
              : '我收到照片/影片了。請問這是「哪裡的什麼部位」？（例如：廚房冷氣、配膳間漏水）',
      },
    ])
  }

  const clearImages = () => {
    setImages([])
  }

  const send = async () => {
    const text = input.trim()
    if ((!text && images.length === 0) || isSending) return

    const hasVideo = images.some((m) => m.source === 'video')
    const mediaText =
      locale === 'en'
        ? hasVideo
          ? '(Sent a video)'
          : '(Sent a photo)'
        : locale === 'tl'
          ? hasVideo
            ? '(Nagpadala ng video)'
            : '(Nagpadala ng larawan)'
        : locale === 'ja'
          ? hasVideo
            ? '（動画を送信しました）'
            : '（写真を送信しました）'
          : hasVideo
            ? '（已傳送影片）'
            : '（已傳送照片）'

    const userContent = text || (images.length > 0 ? mediaText : '')
    const sentAttachments: ChatAttachment[] =
      images.length > 0
        ? images.map((media) => ({
            url: media.source === 'video' ? media.playbackUrl || media.previewUrl : media.previewUrl,
            source: media.source,
            mimeType: media.displayMimeType,
            name: media.name,
          }))
        : []
    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: userContent,
      attachments: sentAttachments.length > 0 ? sentAttachments : undefined,
      hideContentWhenAttachment: text.length === 0 && sentAttachments.length > 0,
    }
    const historyPayload = [...messages, userMsg]
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsSending(true)

    let surnameForPrefix = profile.surname

    try {
      // Intake: step-by-step (surname -> confirm surname -> phone -> confirm phone -> issue)
      const nextProfile: UserProfile = { ...profile }

      const stage =
        !nextProfile.surname
          ? 'needSurname'
          : !nextProfile.surnameConfirmed
            ? 'confirmSurname'
            : !nextProfile.phone
              ? 'needPhone'
              : 'ready'

      if (stage === 'needSurname') {
        const candidate = pickSurnameCandidate(text)
        if (!candidate) {
          promptSurname()
          return
        }
        nextProfile.surname = candidate
        nextProfile.surnameConfirmed = false
        persistProfile(nextProfile)
        surnameForPrefix = nextProfile.surname
        promptConfirmSurname(candidate)
        return
      }

      if (stage === 'confirmSurname') {
        if (isYes(text)) {
          nextProfile.surnameConfirmed = true
          persistProfile(nextProfile)
          surnameForPrefix = nextProfile.surname
          promptPhone(nextProfile.surname)
          return
        }

        const candidate = pickSurnameCandidate(text)
        if (candidate) {
          nextProfile.surname = candidate
          nextProfile.surnameConfirmed = true
          persistProfile(nextProfile)
          surnameForPrefix = nextProfile.surname
          promptPhone(nextProfile.surname)
          return
        }

        if (isNo(text)) {
          persistProfile({})
          promptSurname()
          return
        }

        // ask again
        promptConfirmSurname(nextProfile.surname ?? '')
        return
      }

      if (stage === 'needPhone') {
        const maybePhone = normalizePhone(text)
        if (!maybePhone) {
          promptInvalidPhone(nextProfile.surname)
          return
        }
        nextProfile.phone = maybePhone
        persistProfile(nextProfile)
        surnameForPrefix = nextProfile.surname
        promptConfirmProfileAndAskIssue(nextProfile)
        return
      }

      // stage === 'ready'
      const looksLikeOnlyPhone = Boolean(normalizePhone(text))
      const looksLikeOnlySurname = Boolean(pickSurnameCandidate(text)) && text.length <= 6 && !normalizePhone(text)
      const looksLikeIssue = text.length > 0 && !looksLikeOnlyPhone && !looksLikeOnlySurname

      if (looksLikeIssue && !pendingIssueRef.current) pendingIssueRef.current = text
      if (!text && images.length > 0 && !pendingIssueRef.current) pendingIssueRef.current = mediaText

      let messageToSend = text
      if ((looksLikeOnlyPhone || looksLikeOnlySurname) && pendingIssueRef.current) {
        messageToSend = pendingIssueRef.current
        pendingIssueRef.current = ''
      }
      if (!messageToSend && images.length > 0) messageToSend = mediaText

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          message: messageToSend || userContent,
          storeId,
          storeName,
          locale,
          history: historyPayload,
          profile: nextProfile,
          images: images.map(({ mimeType, data }) => ({ mimeType, data })),
          deviceInfo: {
            device: navigator.userAgent,
            screenSize: `${window.screen.width} x ${window.screen.height}`,
            language: navigator.language,
          },
        }),
      })

      const data = (await res.json()) as any
      if (!res.ok) {
        const errText =
          typeof data?.error === 'string'
            ? data.error
            : locale === 'en'
              ? 'Chat server error.'
              : locale === 'tl'
                ? 'Error sa chat server.'
              : locale === 'ja'
                ? 'チャットサーバーエラーです。'
                : '聊天伺服器錯誤。'
        setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content: errText }])
        return
      }

      const okData = data as ChatApiResponse
      if (okData?.threadId) {
        setThreadId(okData.threadId)
      }

      const assistantText =
        okData?.assistantMessage ||
        (locale === 'en'
          ? 'Thanks. I have recorded your message.'
          : locale === 'tl'
            ? 'Salamat. Naitala ko na ang mensahe mo.'
          : locale === 'ja'
            ? 'ありがとうございます。内容を記録しました。'
            : '多謝。我已記錄內容。')

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: prefixWithName(assistantText, surnameForPrefix) },
      ])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: prefixWithName(
            locale === 'en'
              ? 'Sorry, something went wrong. Please try again.'
              : locale === 'tl'
                ? 'Paumanhin, may nangyaring error. Pakisubukan muli.'
              : locale === 'ja'
                ? 'エラーが発生しました。もう一度お試しください。'
                : '發生錯誤，請再試一次。',
            surnameForPrefix
          ),
        },
      ])
    } finally {
      clearImages()
      setIsSending(false)
    }
  }

  const fullScreenPanel = (
    <section
      className={
        isPageMode
          ? 'h-full min-h-0 bg-white flex flex-col'
          : 'fixed inset-0 z-[9999] overflow-hidden bg-white flex flex-col'
      }
    >
      {!isPageMode && <div className="h-[env(safe-area-inset-top)] bg-white" aria-hidden="true" />}
      {!isPageMode && (
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-lg bg-gray-50 overflow-hidden">
              <img
                src={CHATBOT_GIF_SRC}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-gray-800">
                {locale === 'en' ? 'Support Chat' : locale === 'tl' ? 'Support Chat' : locale === 'ja' ? 'サポートチャット' : '支援聊天'}
              </span>
              <span className="text-xs text-gray-500">{storeName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
            }}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </header>
      )}

      {isPageMode && (
        <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="relative w-20 h-20 rounded-lg bg-gray-50 overflow-hidden">
              <img
                src={CHATBOT_GIF_SRC}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-gray-800">
                {locale === 'en' ? 'Support Chat' : locale === 'tl' ? 'Support Chat' : locale === 'ja' ? 'サポートチャット' : '支援聊天'}
              </span>
              <span className="text-xs text-gray-500">{storeName}</span>
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className={`flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/30 ${
          isPageMode ? 'pb-[200px]' : ''
        }`}
      >
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`rounded-2xl px-5 py-3 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'max-w-[85%] bg-zinc-900 text-white text-center min-w-[8rem]'
                  : 'max-w-[80%] bg-gray-100 text-gray-800'
              }`}
              style={m.role === 'assistant' ? { marginLeft: '6px' } : undefined}
            >
              {!m.hideContentWhenAttachment && renderRichText(m.content)}
              {m.attachments && m.attachments.length > 0 && (
                <div className={`${m.hideContentWhenAttachment ? '' : 'mt-2'} flex flex-col items-end gap-2`}>
                  {m.attachments.map((att) => (
                    <div
                      key={`${m.id}_${att.url}`}
                      className="rounded-lg overflow-hidden border border-white/20 bg-black/10"
                      style={{ width: '120px', maxWidth: '100%' }}
                    >
                      {att.source === 'video' || att.mimeType.startsWith('video/') ? (
                        <video
                          src={att.url}
                          controls
                          playsInline
                          preload="metadata"
                          onLoadedMetadata={keepLatestInView}
                          className="block w-full bg-black"
                          style={{ maxHeight: '140px' }}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={att.url}
                          alt="Sent attachment"
                          onLoad={keepLatestInView}
                          className="block w-full object-contain bg-white"
                          style={{ maxHeight: '140px' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-600 rounded-2xl px-3 py-2 text-sm">
              {locale === 'en' ? 'Typing…' : locale === 'tl' ? 'Nagta-type…' : locale === 'ja' ? '入力中…' : '輸入中…'}
            </div>
          </div>
        )}
      </div>

      <form
        className={`border-t border-gray-100 p-3 flex items-center gap-2 bg-white ${
          isPageMode
            ? 'fixed left-0 right-0 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]'
            : 'pb-[calc(12px+env(safe-area-inset-bottom))]'
        }`}
        style={isPageMode ? { bottom: 'calc(96px + env(safe-area-inset-bottom))' } : undefined}
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          disabled={isSending}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              void addMedia(f).catch(() => {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    role: 'assistant',
                    content:
                      locale === 'en'
                        ? 'Could not attach this file. Please try another photo/video.'
                        : locale === 'tl'
                          ? 'Hindi ma-attach ang file na ito. Subukan ang ibang larawan/video.'
                          : locale === 'ja'
                            ? 'このファイルは添付できませんでした。別の写真/動画をお試しください。'
                            : '未能附加此檔案，請嘗試其他照片/影片。',
                  },
                ])
              })
            }
            e.currentTarget.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
          className={`h-11 w-11 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center ${
            isSending ? 'opacity-50' : ''
          }`}
          aria-label="Attach image"
          style={{ marginLeft: '6px' }}
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (lastPointerTypeRef.current !== 'touch') handleMicPress()
          }}
          onPointerDown={handleMicHoldStart}
          onPointerUp={handleMicHoldEnd}
          onPointerCancel={handleMicHoldEnd}
          onPointerLeave={handleMicHoldEnd}
          disabled={isSending}
          className={`h-11 w-11 rounded-xl flex items-center justify-center disabled:opacity-50 ${
            isListening ? 'bg-zinc-200 text-zinc-900' : 'bg-gray-100 text-gray-700'
          }`}
          aria-label={locale === 'en' ? 'Voice input' : locale === 'tl' ? 'Voice input' : locale === 'ja' ? '音声入力' : '語音輸入'}
        >
          <Mic className="w-5 h-5" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={locale === 'en' ? 'Type a message…' : locale === 'tl' ? 'Mag-type ng mensahe…' : locale === 'ja' ? '入力してください…' : '請輸入…'}
          className="flex-1 h-11 px-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || (input.trim().length === 0 && images.length === 0)}
          className="h-11 w-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      {images.length > 0 && (
        <div
          className={isPageMode ? 'fixed left-0 right-0 z-40 px-3' : 'px-3 pb-3 -mt-1'}
          style={isPageMode ? { bottom: 'calc(214px + env(safe-area-inset-bottom))' } : undefined}
        >
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {images.map((img) => (
              <div
                key={img.previewUrl}
                className="relative rounded-xl overflow-hidden border border-gray-200 bg-white shrink-0"
                style={{ width: '120px', height: '140px' }}
              >
                {img.source === 'video' ? (
                  <video
                    src={img.playbackUrl || img.previewUrl}
                    className="w-full h-full object-contain bg-white"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.previewUrl} alt={img.name} className="w-full h-full object-contain bg-white p-0.5" />
                )}
                {img.source === 'video' ? (
                  <div className="absolute left-1 bottom-1 bg-black/60 text-white text-[10px] px-1 rounded">
                    VIDEO
                  </div>
                ) : null}
              </div>
            ))}
            <button type="button" onClick={clearImages} className="text-sm text-gray-500 hover:underline shrink-0">
              {locale === 'en' ? 'Remove' : locale === 'tl' ? 'Alisin' : locale === 'ja' ? '取り消し' : '移除'}
            </button>
          </div>
        </div>
      )}
    </section>
  )

  return (
    <>
      {isPageMode ? (
        fullScreenPanel
      ) : isEmbedded ? (
        <div className="relative w-full h-full">
          {!isOpen && (
            <button
              type="button"
              onClick={startNewConversation}
              className="absolute right-0 bottom-0 w-[min(46vw,280px)] h-full z-[1]"
              aria-label={launcherLabel}
            >
              <div className="relative w-full h-full">
                <img
                  src={CHATBOT_GIF_SRC}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                  aria-hidden="true"
                />
              </div>
              <div className="absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
                <div className="bg-white border border-gray-300 shadow-lg rounded-3xl px-4 py-3 w-[100px] flex flex-col items-center gap-2">
                  <div className="text-sm font-semibold text-gray-800 text-center">{launcherLabel}</div>
                  <div className="text-xs text-gray-600 text-center">
                    {locale === 'en' ? 'Tap to chat' : locale === 'tl' ? 'I-tap para mag-chat' : locale === 'ja' ? 'タップして相談' : '點擊開始'}
                  </div>
                </div>
              </div>
            </button>
          )}
        </div>
      ) : (
        !isOpen && (
          <button
            type="button"
            onClick={() => router.push('/support')}
            className="fixed z-[60]"
            style={{
              right: '12px',
              bottom: 'calc(120px + env(safe-area-inset-bottom))',
              width: 'clamp(160px, 46vw, 220px)',
              height: 'clamp(160px, 46vw, 220px)',
            }}
            aria-label={launcherLabel}
          >
            <div className="relative w-full h-full">
              <img
                src={CHATBOT_GIF_SRC}
                alt=""
                className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                aria-hidden="true"
              />
            </div>
            <div className="absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
              <div className="bg-white border border-gray-300 shadow-lg rounded-3xl px-4 py-3 w-[100px] flex flex-col items-center gap-2">
                <div className="text-sm font-semibold text-gray-800 text-center">{launcherLabel}</div>
                <div className="text-xs text-gray-600 text-center">
                  {locale === 'en' ? 'Tap to chat' : locale === 'tl' ? 'I-tap para mag-chat' : locale === 'ja' ? 'タップして相談' : '點擊開始'}
                </div>
              </div>
            </div>
          </button>
        )
      )}

      {!isPageMode && isOpen && isMounted ? createPortal(fullScreenPanel, document.body) : null}
    </>
  )
}

