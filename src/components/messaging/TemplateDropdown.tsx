'use client'

import { useState, useRef, useEffect } from 'react'
import type { MessageTemplate } from '@/hooks/useMessageTemplates'

interface TemplateDropdownProps {
  templates: MessageTemplate[]
  loading: boolean
  onSelect: (content: string) => void
  onManage: () => void
}

export function TemplateDropdown({
  templates,
  loading,
  onSelect,
  onManage,
}: TemplateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (template: MessageTemplate) => {
    onSelect(template.content)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Template button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        title="Message templates"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-white">Message Templates</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Use {'{firstname}'} or {'{name}'} for personalization
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                No templates yet
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className="w-full p-3 text-left hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="text-sm font-medium text-white truncate">
                      {template.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {template.content}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-slate-700">
            <button
              onClick={() => {
                setIsOpen(false)
                onManage()
              }}
              className="w-full px-3 py-2 text-sm text-purple-400 hover:text-purple-300 hover:bg-slate-700/50 rounded-lg transition-colors text-center"
            >
              Manage Templates
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
