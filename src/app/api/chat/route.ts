import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { GoogleGenerativeAI } from '@google/generative-ai'

type Extracted = {
  urgency?: 'urgent' | 'normal'
  contact?: { method?: 'phone' | 'email' | 'none'; phone?: string; email?: string }
  summary?: string
}

type IncomingImage = {
  mimeType: string
  data: string // base64 (no data: prefix)
}

type IncomingProfile = {
  surname?: string
  phone?: string
}

type StoredAttachment = {
  url: string
  mimeType: string
  source: 'image' | 'video'
}

let cachedAutoModel: string | null = null
let cachedAutoModelAtMs = 0
const AUTO_MODEL_TTL_MS = 10 * 60 * 1000

function normalizeLocale(locale: unknown) {
  return typeof locale === 'string' && locale.length > 0 ? locale : 'zh'
}

function normalizeText(v: unknown) {
  return typeof v === 'string' ? v.trim() : ''
}

function buildIdempotencyKey(input: { storeId: string; message: string }) {
  const bucket = Math.floor(Date.now() / 10_000)
  const msg = input.message.slice(0, 120)
  return `support:${input.storeId}:${bucket}:${msg}`
}

async function ensureSupportMediaBucket(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const bucketName = 'support-media'
  const { error: bucketErr } = await supabase.storage.getBucket(bucketName)
  if (!bucketErr) return bucketName

  const msg = (bucketErr as any)?.message ?? ''
  if (typeof msg === 'string' && /not found|does not exist/i.test(msg)) {
    const { error: createErr } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: '50MB',
      allowedMimeTypes: ['image/*', 'video/*'],
    })
    if (createErr) throw createErr
    return bucketName
  }
  throw bucketErr
}

function pickExt(mimeType: string) {
  const raw = mimeType.split('/')[1] ?? 'bin'
  return raw.split(';')[0]?.replace(/[^a-zA-Z0-9]/g, '') || 'bin'
}

async function persistAttachments(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  threadId: string
  images?: IncomingImage[]
}) {
  const { supabase, threadId, images } = params
  if (!images || images.length === 0) return [] as StoredAttachment[]

  const bucketName = await ensureSupportMediaBucket(supabase)
  const saved: StoredAttachment[] = []
  const safeImages = images.slice(0, 3)

  for (let i = 0; i < safeImages.length; i++) {
    const img = safeImages[i]
    if (!img?.mimeType || !img?.data) continue
    if (!/^image\/|^video\//.test(img.mimeType)) continue

    try {
      const bytes = Buffer.from(img.data, 'base64')
      // 25MB hard guard for message attachments
      if (bytes.byteLength > 25 * 1024 * 1024) continue

      const ext = pickExt(img.mimeType)
      const path = `${threadId}/${Date.now()}_${i}.${ext}`
      const { error: uploadErr } = await supabase.storage.from(bucketName).upload(path, bytes, {
        contentType: img.mimeType,
        upsert: false,
      })
      if (uploadErr) continue

      const { data } = supabase.storage.from(bucketName).getPublicUrl(path)
      if (!data?.publicUrl) continue
      saved.push({
        url: data.publicUrl,
        mimeType: img.mimeType,
        source: img.mimeType.startsWith('video/') ? 'video' : 'image',
      })
    } catch {
      // continue with next attachment
    }
  }

  return saved
}

async function resolveGeminiModel(apiKey: string, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedAutoModel && Date.now() - cachedAutoModelAtMs < AUTO_MODEL_TTL_MS) {
    return cachedAutoModel
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  const data = (await res.json()) as any
  const models: any[] = Array.isArray(data?.models) ? data.models : []

  const candidates = models
    .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => (typeof m?.name === 'string' ? m.name : ''))
    .filter((n) => n.length > 0)

  const pick =
    candidates.find((n) => /gemini/i.test(n) && /flash/i.test(n)) ||
    candidates.find((n) => /gemini/i.test(n)) ||
    candidates[0] ||
    'models/gemini-pro'

  cachedAutoModel = pick.replace(/^models\//, '')
  cachedAutoModelAtMs = Date.now()
  return cachedAutoModel || 'gemini-pro'
}

function buildFallbackResponse(params: {
  locale: string
  message: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  profile?: IncomingProfile
  hasImages: boolean
}): { assistant_text: string; extracted?: Extracted } {
  const text = normalizeText(params.message)
  const lc = text.toLowerCase()
  const allText = `${(params.history ?? []).map((h) => h.content).join('\n')}\n${text}`.toLowerCase()

  const ackWords = new Set([
    'yes',
    'y',
    'ok',
    'okay',
    'no',
    'nope',
    'sure',
    'got it',
    'oo',
    'opo',
    'sige',
    'はい',
    'うん',
    '了解',
    'いいえ',
    '係',
    '唔係',
    '好',
    'ok啦',
  ])
  const looksLikeAck = text.length <= 3 || ackWords.has(lc)
  const asksMeaning =
    /what is that mean|what does that mean|what does it mean|どういうこと|どういう意味|咩意思|什么意思/.test(lc)

  const hasMachine = /machine|model|serial|plate|fgjo|jo-\d|equipment|機械|機器|型番|型號|序號|銘板|oven|freezer|chiller/.test(allText)
  const hasSymptom = /broken|not work|not working|error|leak|noise|vibration|hot|cold|not cooling|no power|smoke|problem|issue|故障|異常|漏|異音|不冷|不凍|壊/.test(
    allText
  )
  const hasUrgency = /urgent|asap|immediately|emergency|today|now|緊急|至急|急ぎ|立刻|盡快|尽快/.test(allText)
  const hasMedia =
    params.hasImages ||
    /(sent a photo|sent a video|写真を送信|動画を送信|已傳送照片|已傳送影片|nagpadala ng larawan|nagpadala ng video)/.test(
      allText
    )
  const hasPhone = Boolean(params.profile?.phone)

  const extracted: Extracted = {}
  if (hasUrgency) extracted.urgency = /urgent|asap|immediately|emergency|緊急|至急|立刻/.test(allText) ? 'urgent' : 'normal'
  if (hasPhone) extracted.contact = { method: 'phone', phone: params.profile?.phone }
  if (text && !looksLikeAck) extracted.summary = text.slice(0, 280)

  if (params.locale === 'ja') {
    if (asksMeaning) {
      return {
        assistant_text:
          '「受付して担当へ共有する」という意味です。解決を早めるため、故障内容（何がどう壊れたか）と機械名・型番/シリアルを教えてください。',
        extracted,
      }
    }
    if (looksLikeAck || !hasSymptom) {
      return {
        assistant_text:
          '承知しました。まず、故障内容を1文で教えてください（例: オーブンの電源が入らない / 冷却が弱い）。',
        extracted,
      }
    }
    if (!hasMachine) {
      return {
        assistant_text: '次に、機械名と型番/シリアル（銘板情報）を教えてください。わからなければ銘板写真でも大丈夫です。',
        extracted,
      }
    }
    if (!hasUrgency) {
      return {
        assistant_text: '緊急度を教えてください（緊急 / 通常）。',
        extracted,
      }
    }
    if (!hasMedia) {
      return {
        assistant_text: '可能なら故障箇所の写真/動画を1枚送ってください。確認が早くなります。',
        extracted,
      }
    }
    return {
      assistant_text: 'ありがとうございます。必要情報を受け付けました。担当チームで確認し、折り返し連絡します。',
      extracted,
    }
  }

  if (params.locale === 'tl') {
    if (asksMeaning) {
      return {
        assistant_text:
          'Ibig sabihin nito: naipasa na ang report mo sa team. Para mas mabilis ang tulong, ilagay ang eksaktong sira at machine name + model/serial.',
        extracted,
      }
    }
    if (looksLikeAck || !hasSymptom) {
      return {
        assistant_text:
          'Sige. Paki-describe ang problema sa isang pangungusap (hal: hindi umiilaw ang oven / mahina ang lamig).',
        extracted,
      }
    }
    if (!hasMachine) {
      return {
        assistant_text: 'Pakibigay ang machine name at model/serial plate. Kung di alam, puwedeng larawan ng plate.',
        extracted,
      }
    }
    if (!hasUrgency) {
      return {
        assistant_text: 'Ano ang urgency nito? (urgent o normal)',
        extracted,
      }
    }
    if (!hasMedia) {
      return {
        assistant_text: 'Kung maaari, magpadala ng 1 photo/video ng sira para mas mabilis ma-check.',
        extracted,
      }
    }
    return {
      assistant_text: 'Salamat. Kumpleto na ang initial details at ipapasa ko na ito sa support team.',
      extracted,
    }
  }

  if (params.locale === 'zh') {
    if (asksMeaning) {
      return {
        assistant_text: '意思是我已幫你登記並轉交團隊。為加快處理，請提供故障現象，以及機器名稱與型號/序號。',
        extracted,
      }
    }
    if (looksLikeAck || !hasSymptom) {
      return {
        assistant_text: '收到。請先用一句描述故障現象（例如：焗爐無法開機 / 冷凍不夠凍）。',
        extracted,
      }
    }
    if (!hasMachine) {
      return {
        assistant_text: '請提供機器名稱及型號/序號牌；如果不清楚，可直接上傳銘牌照片。',
        extracted,
      }
    }
    if (!hasUrgency) {
      return {
        assistant_text: '請問緊急程度是「緊急」還是「一般」？',
        extracted,
      }
    }
    if (!hasMedia) {
      return {
        assistant_text: '如可以，請上傳1張故障位置照片或短片，會更快確認問題。',
        extracted,
      }
    }
    return {
      assistant_text: '多謝，初步資料已齊，我會轉交支援團隊跟進。',
      extracted,
    }
  }

  // en (default)
  if (asksMeaning) {
    return {
      assistant_text:
        'It means your report was logged and shared with the team. To speed this up, please provide the exact symptom plus machine name and model/serial.',
      extracted,
    }
  }
  if (looksLikeAck || !hasSymptom) {
    return {
      assistant_text:
        'Got it. Please describe the issue in one sentence (for example: oven does not power on / freezer is not cooling).',
      extracted,
    }
  }
  if (!hasMachine) {
    return {
      assistant_text: 'Please share the machine name and model/serial plate. If unknown, a photo of the serial plate is fine.',
      extracted,
    }
  }
  if (!hasUrgency) {
    return {
      assistant_text: 'Please tell me the urgency level: urgent or normal.',
      extracted,
    }
  }
  if (!hasMedia) {
    return {
      assistant_text: 'If possible, please send one photo/video of the faulty part to help faster diagnosis.',
      extracted,
    }
  }
  return {
    assistant_text: 'Thanks, I have enough initial details and will forward this to the support team now.',
    extracted,
  }
}

async function callLLM(params: {
  locale: string
  storeName: string
  userMessage: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  profile?: IncomingProfile
  images?: IncomingImage[]
}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const envModel = typeof process.env.GEMINI_MODEL === 'string' ? process.env.GEMINI_MODEL.trim() : ''

  const system =
    params.locale === 'ja'
      ? `あなたは店舗スタッフ向けのサポート受付です。目的は「必要情報を丁寧に収集し、要約してチケット化」することです。
不明点は追加質問してください。断定しすぎず、安全に案内してください。
必ず JSON だけを返してください。形式:
{"assistant_text":"...","extracted":{"urgency":"urgent|normal?","contact":{"method":"phone|email|none?","phone":"?","email":"?"},"summary":"?"}}
assistant_text はユーザー向けの自然文（日本語）です。`
      : params.locale === 'en'
        ? `You are a support intake assistant for store staff. Your goal is to collect required details and create a clear ticket summary.
Ask follow-up questions when information is missing. Avoid overconfident claims.
Return ONLY JSON:
{"assistant_text":"...","extracted":{"urgency":"urgent|normal?","contact":{"method":"phone|email|none?","phone":"?","email":"?"},"summary":"?"}}
assistant_text must be in English.`
        : params.locale === 'tl'
          ? `Ikaw ay support intake assistant para sa store staff. Layunin mong kolektahin ang kinakailangang detalye at gumawa ng malinaw na ticket summary.
Magtanong ng follow-up kapag kulang ang impormasyon. Iwasan ang sobrang kumpiyansang pahayag.
Magbalik ng JSON LAMANG:
{"assistant_text":"...","extracted":{"urgency":"urgent|normal?","contact":{"method":"phone|email|none?","phone":"?","email":"?"},"summary":"?"}}
assistant_text ay dapat nasa Tagalog.`
        : `你是店舖員工的支援受理助理。目標是收集必要資訊並整理成可跟進的工單摘要。
資料不足時要追問。避免過度肯定的判斷。
只回傳 JSON：
{"assistant_text":"...","extracted":{"urgency":"urgent|normal?","contact":{"method":"phone|email|none?","phone":"?","email":"?"},"summary":"?"}}
assistant_text 使用繁體中文。`

  const profileText =
    params.profile?.surname || params.profile?.phone
      ? `User info:\n- surname: ${params.profile?.surname ?? '(unknown)'}\n- mobile: ${params.profile?.phone ?? '(unknown)'}\n\n`
      : ''

  const intakeRules =
    params.locale === 'ja'
      ? `重要: 機械/機器の故障の場合は「機械名」と「型番/シリアル（銘板）」を必ず確認してください。\n` +
        `情報が出ない場合は「銘板（シリアルプレート）の写真」または「機械全体と故障箇所の写真/動画」を依頼してください。`
      : params.locale === 'en'
        ? `Important: For machine/equipment issues, always ask for machine name and model/serial plate.\n` +
          `If they can't provide it, ask for a photo of the serial plate, or a photo/video of the machine and the faulty part.`
        : params.locale === 'tl'
          ? `Mahalaga: Para sa machine/equipment issues, laging hingin ang machine name at model/serial plate.\n` +
            `Kung hindi nila maibigay, humingi ng larawan ng serial plate, o larawan/video ng makina at sira na bahagi.`
        : `重要：如屬機械/設備故障，必須確認機械名稱及型號/序號牌。\n` +
          `如未能提供，請要求序號牌照片，或機器及故障位置的照片/影片。`

  const nameRule =
    params.profile?.surname
      ? params.locale === 'ja'
        ? `会話では必ずユーザーを「${params.profile.surname}さん」と呼びかけ、assistant_text の冒頭も可能な限り「${params.profile.surname}さん、」で始めてください。`
        : params.locale === 'en'
          ? `Address the user by name (${params.profile.surname}) and prefer starting assistant_text with their name.`
          : params.locale === 'tl'
            ? `Tawagin ang user gamit ang pangalan (${params.profile.surname}) at kung maaari simulan ang assistant_text gamit ang pangalan nila.`
          : `對話中請稱呼用戶為「${params.profile.surname}先生」，assistant_text 也盡量以「${params.profile.surname}先生，」開頭。`
      : ''

  const genAI = new GoogleGenerativeAI(apiKey)
  const makeModel = (modelName: string) =>
    genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.2 } })

  const historyText = (params.history ?? [])
    .slice(-12)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const parts: any[] = [
    {
      text:
        `SYSTEM:\n${system}\n\n` +
        profileText +
        `${intakeRules}\n\n` +
        (nameRule ? `${nameRule}\n\n` : '') +
        `Store: ${params.storeName}\n` +
        (historyText ? `Conversation so far:\n${historyText}\n\n` : '') +
        `User message: ${params.userMessage}`,
    },
  ]
  for (const img of params.images ?? []) {
    if (!img?.mimeType || !img?.data) continue
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    })
  }

  let content: string | null = null
  try {
    const primaryModel = envModel || (await resolveGeminiModel(apiKey))
    const model = makeModel(primaryModel)
    const result = await model.generateContent(parts)
    const t = result?.response?.text?.()
    content = typeof t === 'string' ? t : null
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : ''
    // invalid/unsupported model name: retry once with auto-selected model
    if (/404|not found|not supported/i.test(msg)) {
      try {
        const fallbackModelName = await resolveGeminiModel(apiKey, true)
        const model = makeModel(fallbackModelName)
        const result = await model.generateContent(parts)
        const t = result?.response?.text?.()
        content = typeof t === 'string' ? t : null
      } catch {
        content = null
      }
    } else {
      content = null
    }
  }
  if (typeof content !== 'string') return null

  const trimmed = content.trim()
  const candidate =
    trimmed.startsWith('```')
      ? trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
      : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) {
    // If the model didn't follow JSON instruction, still return conversational text.
    return { assistant_text: trimmed }
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as { assistant_text: string; extracted?: Extracted }
  } catch {
    return { assistant_text: trimmed }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const storeId = normalizeText(body?.storeId)
    const storeName = normalizeText(body?.storeName) || 'Unknown'
    const message = normalizeText(body?.message)
    const locale = normalizeLocale(body?.locale)
    const images = Array.isArray(body?.images) ? (body.images as IncomingImage[]) : undefined
    const llmImages = (images ?? []).filter((img) => /^image\//.test(img?.mimeType ?? '')).slice(0, 3)
    const history = Array.isArray(body?.history) ? (body.history as { role: 'user' | 'assistant'; content: string }[]) : undefined
    const profile =
      body?.profile && typeof body.profile === 'object'
        ? (body.profile as IncomingProfile)
        : undefined

    if (!storeId || !message) {
      return NextResponse.json({ error: 'Missing storeId or message' }, { status: 400 })
    }

    let supabase: ReturnType<typeof getSupabaseAdmin> | null = null
    try {
      supabase = getSupabaseAdmin()
    } catch {
      supabase = null
    }

    const providedThreadId = normalizeText(body?.threadId)

    // Create thread if needed
    let threadId = providedThreadId
    if (!threadId && supabase) {
      try {
        const { data, error } = await supabase
          .from('support_threads')
          .insert({
            store_id: storeId,
            store_name: storeName,
            status: 'open',
          })
          .select('id')
          .single()
        if (error) throw error
        threadId = data.id
      } catch (e) {
        // If schema isn't applied yet, still allow chatting.
        console.error('support_threads insert failed:', e)
        supabase = null
      }
    }
    if (!threadId) threadId = `local_${storeId}`

    const idempotencyKey = buildIdempotencyKey({ storeId, message })
    let attachments: StoredAttachment[] = []
    if (supabase && images && images.length > 0) {
      try {
        attachments = await persistAttachments({ supabase, threadId, images })
      } catch (e) {
        console.error('support attachment upload failed:', e)
      }
    }

    // Store user message
    if (supabase) {
      try {
        const { error: userMsgErr } = await supabase.from('support_messages').insert({
          thread_id: threadId,
          role: 'user',
          content: message,
          meta: {
            idempotencyKey,
            locale,
            attachmentCount: attachments.length,
            attachments,
          },
        })
        if (userMsgErr) throw userMsgErr
      } catch (e) {
        console.error('support_messages(user) insert failed:', e)
        supabase = null
      }
    }

    const llm = await callLLM({ locale, storeName, userMessage: message, images: llmImages, history, profile })
    const fallback = llm
      ? null
      : buildFallbackResponse({
          locale,
          message,
          history,
          profile,
          hasImages: Boolean(images && images.length > 0),
        })

    const assistantText = llm?.assistant_text || fallback?.assistant_text || ''
    const extracted = llm?.extracted ?? fallback?.extracted

    // Update thread best-effort
    if (supabase) {
      try {
        const updatePayload: Record<string, any> = {
          store_id: storeId,
          store_name: storeName,
        }
        if (extracted?.summary) updatePayload.summary = extracted.summary
        if (extracted?.urgency) updatePayload.urgency = extracted.urgency
        const mergedContact: Record<string, any> = {}
        if (extracted?.contact && typeof extracted.contact === 'object') {
          Object.assign(mergedContact, extracted.contact as any)
        }
        if (profile?.surname) mergedContact.surname = profile.surname
        if (profile?.phone) {
          mergedContact.phone = profile.phone
          if (!mergedContact.method) mergedContact.method = 'phone'
        }
        if (Object.keys(mergedContact).length > 0) updatePayload.contact = mergedContact

        await supabase.from('support_threads').update(updatePayload).eq('id', threadId)

        // Store assistant message
        await supabase.from('support_messages').insert({
          thread_id: threadId,
          role: 'assistant',
          content: assistantText,
          meta: { extracted },
        })
      } catch (e) {
        console.error('support_threads/messages update failed:', e)
      }
    }

    return NextResponse.json({
      threadId,
      assistantMessage: assistantText,
      extracted,
    })
  } catch (error) {
    console.error('api/chat error:', error)
    const msg =
      error instanceof Error
        ? error.message
        : typeof (error as any)?.message === 'string'
          ? (error as any).message
          : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

