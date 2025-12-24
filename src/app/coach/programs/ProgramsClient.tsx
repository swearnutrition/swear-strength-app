'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
}

interface ProgramsClientProps {
  programs: Program[]
}

const typeColors = {
  strength: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  mobility: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  cardio: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
}

export function ProgramsClient({ programs: initialPrograms }: ProgramsClientProps) {
  const [programs, setPrograms] = useState(initialPrograms)
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const filteredPrograms = programs.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreate = async () => {
    setCreating(true)
    const { data: userData } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('programs')
      .insert({
        name: 'Untitled Program',
        type: 'strength',
        created_by: userData.user?.id,
      })
      .select()
      .single()

    if (data && !error) {
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
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-xl transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Program
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative mb-6">
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
              onClick={handleCreate}
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
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ProgramCard({
  program,
  onDelete,
  onDuplicate,
}: {
  program: Program
  onDelete: () => void
  onDuplicate: () => void
}) {
  return (
    <Link
      href={`/coach/programs/${program.id}`}
      className="block bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all group shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-medium px-2 py-1 rounded-lg ${typeColors[program.type]}`}>
          {program.type.charAt(0).toUpperCase() + program.type.slice(1)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>{program.week_count} week{program.week_count !== 1 ? 's' : ''}</span>
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
