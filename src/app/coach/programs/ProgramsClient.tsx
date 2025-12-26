'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ImportProgramModal } from './ImportProgramModal'
import { AssignProgramModal } from './AssignProgramModal'

type ProgramDifficulty = 'beginner' | 'intermediate' | 'advanced'
type ProgramStyle = 'powerlifting' | 'bodybuilding' | 'general_fitness' | 'athletic' | 'rehab_prehab' | 'crossfit' | 'olympic_weightlifting' | 'strongman' | 'calisthenics' | 'hybrid' | 'sport_specific'

interface Program {
  id: string
  name: string
  type: 'strength' | 'mobility' | 'cardio'
  description: string | null
  is_indefinite: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  week_count: number
  difficulty: ProgramDifficulty | null
  style: ProgramStyle | null
  primary_muscles: string[]
  injury_friendly: string[]
  days_per_week?: number
}


interface ProgramsClientProps {
  programs: Program[]
}

const typeColors = {
  strength: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  mobility: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  cardio: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
}

const difficultyColors: Record<ProgramDifficulty, string> = {
  beginner: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
  intermediate: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  advanced: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
}

const styleLabels: Record<ProgramStyle, string> = {
  powerlifting: 'Powerlifting',
  bodybuilding: 'Bodybuilding',
  general_fitness: 'General Fitness',
  athletic: 'Athletic',
  rehab_prehab: 'Rehab/Prehab',
  crossfit: 'CrossFit',
  olympic_weightlifting: 'Olympic Lifting',
  strongman: 'Strongman',
  calisthenics: 'Calisthenics',
  hybrid: 'Hybrid',
  sport_specific: 'Sport Specific',
}

function formatMuscle(muscle: string): string {
  return muscle
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function ProgramsClient({ programs: initialPrograms }: ProgramsClientProps) {
  const [programs, setPrograms] = useState(initialPrograms)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'strength' | 'mobility' | 'cardio'>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<ProgramDifficulty | null>(null)
  const [styleFilter, setStyleFilter] = useState<ProgramStyle | null>(null)
  const [injuryFriendlyOnly, setInjuryFriendlyOnly] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [assignModalProgram, setAssignModalProgram] = useState<{ id: string; name: string; description: string | null } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const activeFilterCount = [difficultyFilter, styleFilter, injuryFriendlyOnly].filter(Boolean).length

  const filteredPrograms = programs.filter((p) => {
    if (!p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    if (difficultyFilter && p.difficulty !== difficultyFilter) return false
    if (styleFilter && p.style !== styleFilter) return false
    if (injuryFriendlyOnly && (!p.injury_friendly || p.injury_friendly.length === 0)) return false
    return true
  })

  const handleCreate = async (type: 'strength' | 'mobility' | 'cardio' = 'strength') => {
    setCreating(true)
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user?.id) {
      console.error('No user ID found')
      setCreating(false)
      return
    }

    const { data, error } = await supabase
      .from('programs')
      .insert({
        name: `Untitled ${type.charAt(0).toUpperCase() + type.slice(1)} Program`,
        type,
        created_by: userData.user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating program:', error)
      alert('Failed to create program: ' + error.message)
      setCreating(false)
      return
    }

    if (data) {
      router.refresh()
      router.push(`/coach/programs/${data.id}`)
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to archive this program?')) return

    await supabase
      .from('programs')
      .update({ is_archived: true })
      .eq('id', id)

    setPrograms(programs.filter((p) => p.id !== id))
  }

  const handleDuplicate = async (program: Program) => {
    const { data: userData } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('programs')
      .insert({
        name: `${program.name} (Copy)`,
        type: program.type,
        description: program.description,
        is_indefinite: program.is_indefinite,
        created_by: userData.user?.id,
      })
      .select()
      .single()

    if (data && !error) {
      router.push(`/coach/programs/${data.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/coach" className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Programs</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-2 px-4 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import
              </button>
              <button
                onClick={() => handleCreate(typeFilter === 'all' ? 'strength' : typeFilter)}
                disabled={creating}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-xl transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New {typeFilter !== 'all' ? typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1) + ' ' : ''}Program
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
          />
        </div>

        {/* Filter sections */}
        <div className="space-y-3 mb-6">
          {/* Type filters - primary row */}
          <div className="flex gap-2">
            {(['all', 'strength', 'mobility', 'cardio'] as const).map((type) => {
              const isActive = typeFilter === type
              const colors = {
                all: isActive ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
                strength: isActive ? 'bg-purple-600 text-white' : 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-500/30',
                mobility: isActive ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30',
                cardio: isActive ? 'bg-orange-600 text-white' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-500/30',
              }
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${colors[type]}`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              )
            })}
          </div>

          {/* Secondary filters row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* Difficulty */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Level</span>
              <div className="flex gap-1">
                {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setDifficultyFilter(difficultyFilter === level ? null : level)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      difficultyFilter === level
                        ? difficultyColors[level]
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Style</span>
              <div className="flex flex-wrap gap-1">
                {([
                  { value: 'general_fitness', label: 'General' },
                  { value: 'bodybuilding', label: 'Bodybuilding' },
                  { value: 'powerlifting', label: 'Powerlifting' },
                  { value: 'athletic', label: 'Athletic' },
                  { value: 'strongman', label: 'Strongman' },
                  { value: 'calisthenics', label: 'Calisthenics' },
                  { value: 'rehab_prehab', label: 'Rehab' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setStyleFilter(styleFilter === value ? null : value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                      styleFilter === value
                        ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Injury-Friendly toggle */}
            <button
              onClick={() => setInjuryFriendlyOnly(!injuryFriendlyOnly)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all flex items-center gap-1.5 ${
                injuryFriendlyOnly
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill={injuryFriendlyOnly ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Injury-Friendly
            </button>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setDifficultyFilter(null)
                  setStyleFilter(null)
                  setInjuryFriendlyOnly(false)
                }}
                className="text-xs font-medium text-purple-600 hover:text-purple-500 transition-all"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <p className="text-slate-500 text-sm mb-4">
          {filteredPrograms.length} program{filteredPrograms.length !== 1 ? 's' : ''}
        </p>

        {filteredPrograms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-slate-500">No programs found</p>
            <button
              onClick={() => handleCreate()}
              className="mt-4 text-purple-600 hover:text-purple-500 font-medium"
            >
              Create your first program
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onDelete={() => handleDelete(program.id)}
                onDuplicate={() => handleDuplicate(program)}
                onAssign={() => setAssignModalProgram({ id: program.id, name: program.name, description: program.description })}
                onFilterType={(t) => setTypeFilter(t)}
                onFilterDifficulty={(d) => setDifficultyFilter(d)}
                onFilterStyle={(s) => setStyleFilter(s)}
                onFilterInjuryFriendly={() => setInjuryFriendlyOnly(true)}
              />
            ))}
          </div>
        )}
      </main>

      <ImportProgramModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={(programId) => {
          setShowImportModal(false)
          router.push(`/coach/programs/${programId}`)
        }}
      />

      {assignModalProgram && (
        <AssignProgramModal
          isOpen={true}
          onClose={() => setAssignModalProgram(null)}
          programId={assignModalProgram.id}
          programName={assignModalProgram.name}
          programDescription={assignModalProgram.description}
          onSuccess={() => {
            setAssignModalProgram(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function ProgramCard({
  program,
  onDelete,
  onDuplicate,
  onAssign,
  onFilterType,
  onFilterDifficulty,
  onFilterStyle,
  onFilterInjuryFriendly,
}: {
  program: Program
  onDelete: () => void
  onDuplicate: () => void
  onAssign: () => void
  onFilterType: (type: 'strength' | 'mobility' | 'cardio') => void
  onFilterDifficulty: (difficulty: ProgramDifficulty) => void
  onFilterStyle: (style: ProgramStyle) => void
  onFilterInjuryFriendly: () => void
}) {
  return (
    <Link
      href={`/coach/programs/${program.id}`}
      className="block bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all group shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={(e) => {
              e.preventDefault()
              onFilterType(program.type)
            }}
            className={`text-xs font-medium px-2 py-1 rounded-lg hover:ring-2 hover:ring-offset-1 hover:ring-purple-300 dark:hover:ring-purple-600 transition-all ${typeColors[program.type]}`}
          >
            {program.type.charAt(0).toUpperCase() + program.type.slice(1)}
          </button>
          {program.difficulty && (
            <button
              onClick={(e) => {
                e.preventDefault()
                onFilterDifficulty(program.difficulty!)
              }}
              className={`text-xs font-medium px-2 py-1 rounded-lg hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 dark:hover:ring-slate-600 transition-all ${difficultyColors[program.difficulty]}`}
            >
              {program.difficulty.charAt(0).toUpperCase() + program.difficulty.slice(1)}
            </button>
          )}
          {program.style && (
            <button
              onClick={(e) => {
                e.preventDefault()
                onFilterStyle(program.style!)
              }}
              className="text-xs font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 dark:hover:ring-slate-600 transition-all"
            >
              {styleLabels[program.style]}
            </button>
          )}
          {program.injury_friendly && program.injury_friendly.length > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault()
                onFilterInjuryFriendly()
              }}
              className="text-xs font-medium px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:ring-2 hover:ring-offset-1 hover:ring-emerald-300 dark:hover:ring-emerald-600 transition-all flex items-center gap-1"
              title={`Injury-friendly: ${program.injury_friendly.join(', ')}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.preventDefault()
              onAssign()
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all"
            title="Assign to Client"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              onDuplicate()
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Duplicate"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              onDelete()
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            title="Archive"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{program.name}</h3>

      {program.description && (
        <p className="text-slate-500 text-sm line-clamp-2 mb-3">{program.description}</p>
      )}

      {/* Primary muscles */}
      {program.primary_muscles && program.primary_muscles.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {program.primary_muscles.slice(0, 3).map((muscle) => (
            <span
              key={muscle}
              className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            >
              {formatMuscle(muscle)}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>{program.week_count} week{program.week_count !== 1 ? 's' : ''}</span>
        {program.days_per_week && program.days_per_week > 0 && (
          <span>{program.days_per_week}x/week</span>
        )}
        {program.is_indefinite && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rolling
          </span>
        )}
      </div>
    </Link>
  )
}
