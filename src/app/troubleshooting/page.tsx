'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { HelpCircle, ArrowRight, AlertTriangle } from 'lucide-react'
import Header from '@/components/Header'

type SymptomId = 'cooling' | 'water_leak' | 'noise'

type CheckStep = {
  id: string
  question: string
  yesNext?: string
  noResolution?: string
}

type SymptomFlow = {
  title: string
  description: string
  steps: CheckStep[]
  fallback: string
}

export default function TroubleshootingPage() {
  const router = useRouter()
  const t = useTranslations('troubleshooting')
  const [symptomId, setSymptomId] = useState<SymptomId | null>(null)
  const [stepId, setStepId] = useState<string | null>(null)
  const [resolvedText, setResolvedText] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])

  const flow = useMemo<Record<SymptomId, SymptomFlow>>(
    () => ({
      cooling: {
        title: t('symptoms.cooling.title'),
        description: t('symptoms.cooling.description'),
        steps: [
          {
            id: 'power',
            question: t('symptoms.cooling.steps.power.question'),
            yesNext: 'door',
            noResolution: t('symptoms.cooling.steps.power.noResolution'),
          },
          {
            id: 'door',
            question: t('symptoms.cooling.steps.door.question'),
            yesNext: 'airflow',
            noResolution: t('symptoms.cooling.steps.door.noResolution'),
          },
          {
            id: 'airflow',
            question: t('symptoms.cooling.steps.airflow.question'),
            yesNext: 'final',
            noResolution: t('symptoms.cooling.steps.airflow.noResolution'),
          },
        ],
        fallback: t('symptoms.cooling.fallback'),
      },
      water_leak: {
        title: t('symptoms.waterLeak.title'),
        description: t('symptoms.waterLeak.description'),
        steps: [
          {
            id: 'valve',
            question: t('symptoms.waterLeak.steps.valve.question'),
            yesNext: 'drain',
            noResolution: t('symptoms.waterLeak.steps.valve.noResolution'),
          },
          {
            id: 'drain',
            question: t('symptoms.waterLeak.steps.drain.question'),
            yesNext: 'joint',
            noResolution: t('symptoms.waterLeak.steps.drain.noResolution'),
          },
          {
            id: 'joint',
            question: t('symptoms.waterLeak.steps.joint.question'),
            yesNext: 'final',
            noResolution: t('symptoms.waterLeak.steps.joint.noResolution'),
          },
        ],
        fallback: t('symptoms.waterLeak.fallback'),
      },
      noise: {
        title: t('symptoms.noise.title'),
        description: t('symptoms.noise.description'),
        steps: [
          {
            id: 'foreign',
            question: t('symptoms.noise.steps.foreign.question'),
            yesNext: 'level',
            noResolution: t('symptoms.noise.steps.foreign.noResolution'),
          },
          {
            id: 'level',
            question: t('symptoms.noise.steps.level.question'),
            yesNext: 'fan',
            noResolution: t('symptoms.noise.steps.level.noResolution'),
          },
          {
            id: 'fan',
            question: t('symptoms.noise.steps.fan.question'),
            yesNext: 'final',
            noResolution: t('symptoms.noise.steps.fan.noResolution'),
          },
        ],
        fallback: t('symptoms.noise.fallback'),
      },
    }),
    [t]
  )

  const selectedFlow = symptomId ? flow[symptomId] : null
  const currentStep = useMemo(() => {
    if (!selectedFlow || !stepId) return null
    return selectedFlow.steps.find((step) => step.id === stepId) ?? null
  }, [selectedFlow, stepId])

  const startFlow = (nextSymptomId: SymptomId) => {
    setSymptomId(nextSymptomId)
    setResolvedText(null)
    setHistory([])
    setStepId(flow[nextSymptomId].steps[0]?.id ?? null)
  }

  const answerYes = () => {
    if (!currentStep || !selectedFlow) return
    if (currentStep.yesNext === 'final') {
      setResolvedText(selectedFlow.fallback)
      setStepId(null)
      setHistory((prev) => [...prev, `${currentStep.question} -> ${t('answer.yes')}`])
      return
    }
    setStepId(currentStep.yesNext ?? null)
    setHistory((prev) => [...prev, `${currentStep.question} -> ${t('answer.yes')}`])
  }

  const answerNo = () => {
    if (!currentStep) return
    setResolvedText(currentStep.noResolution ?? t('fallback.escalate'))
    setStepId(null)
    setHistory((prev) => [...prev, `${currentStep.question} -> ${t('answer.no')}`])
  }

  const escalate = () => {
    const summary = [
      selectedFlow?.title ? `${t('summary.symptom')}: ${selectedFlow.title}` : null,
      history.length > 0 ? `${t('summary.history')}: ${history.join(' / ')}` : null,
      resolvedText ? `${t('summary.result')}: ${resolvedText}` : null,
    ]
      .filter(Boolean)
      .join(' | ')
    router.push(`/customer-call?summary=${encodeURIComponent(summary)}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Header showBack title={t('pageTitle')} titleClassName="ml-1.5" />
      <main className="px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-5 h-5 text-zinc-900" style={{ marginLeft: '6px' }} />
            <h2 className="font-semibold text-gray-800" style={{ marginLeft: '6px' }}>{t('cardTitle')}</h2>
          </div>
          <p className="text-sm text-gray-500" style={{ marginLeft: '6px' }}>{t('cardDescription')}</p>
        </div>

        {!symptomId && (
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
            {(Object.entries(flow) as [SymptomId, SymptomFlow][]).map(([id, symptom]) => (
              <button
                key={id}
                onClick={() => startFlow(id)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
              >
                <p className="font-medium text-gray-800" style={{ marginLeft: '6px' }}>{symptom.title}</p>
                <p className="text-sm text-gray-500" style={{ marginLeft: '6px' }}>{symptom.description}</p>
              </button>
            ))}
          </div>
        )}

        {symptomId && currentStep && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-2" style={{ marginLeft: '6px' }}>{flow[symptomId].title}</p>
            <h3 className="text-lg font-semibold text-gray-800 mb-4" style={{ marginLeft: '6px' }}>{currentStep.question}</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={answerYes}
                className="rounded-xl bg-emerald-600 text-white py-3 font-semibold"
              >
                {t('answer.yes')}
              </button>
              <button
                onClick={answerNo}
                className="rounded-xl bg-zinc-700 text-white py-3 font-semibold"
              >
                {t('answer.no')}
              </button>
            </div>
          </div>
        )}

        {symptomId && resolvedText && (
          <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" style={{ marginLeft: '6px' }} />
              <p className="text-sm text-gray-700" style={{ marginLeft: '6px' }}>{resolvedText}</p>
            </div>
            <button
              onClick={escalate}
              className="w-full rounded-xl bg-zinc-900 text-white py-3 font-semibold flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              {t('actions.escalate')}
            </button>
            <button
              onClick={() => {
                setSymptomId(null)
                setStepId(null)
                setResolvedText(null)
                setHistory([])
              }}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-gray-700"
            >
              {t('actions.retry')}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
