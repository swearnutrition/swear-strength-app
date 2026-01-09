'use client'

import { useState, useMemo } from 'react'
import { useSessionPackages } from '@/hooks/useSessionPackages'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { SessionPackage, CreateSessionPackagePayload, BookingWithDetails, ClientSubscription, CreateSubscriptionPayload, SubscriptionType } from '@/types/booking'

interface Client {
  id: string
  name: string
  email: string
  avatar_url: string | null
  isPending?: boolean
}

interface PackagesClientProps {
  clients: Client[]
  completedSessionsByClient: Record<string, number>
  initialSubscriptions?: ClientSubscription[]
}

export function PackagesClient({ clients, completedSessionsByClient, initialSubscriptions = [] }: PackagesClientProps) {
  const { packages, loading, createPackage, adjustPackage } = useSessionPackages()
  const [activeTab, setActiveTab] = useState<'packages' | 'subscriptions'>('packages')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<SessionPackage | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'depleted'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>(initialSubscriptions)
  const [showCreateSubscriptionModal, setShowCreateSubscriptionModal] = useState(false)
  const [showAdjustSubscriptionModal, setShowAdjustSubscriptionModal] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<ClientSubscription | null>(null)
  const [subscriptionFilterStatus, setSubscriptionFilterStatus] = useState<'all' | 'active' | 'paused'>('all')
  const [subscriptionSearchTerm, setSubscriptionSearchTerm] = useState('')
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  // Create subscription form state
  const [newSubscription, setNewSubscription] = useState<CreateSubscriptionPayload>({
    clientId: '',
    subscriptionType: 'hybrid',
    monthlySessions: 4,
    sessionDurationMinutes: 60,
    notes: '',
  })

  // Adjust subscription form state
  const [subscriptionAdjustment, setSubscriptionAdjustment] = useState(0)
  const [subscriptionAdjustReason, setSubscriptionAdjustReason] = useState('')

  // Create package form state
  const [newPackage, setNewPackage] = useState<CreateSessionPackagePayload>({
    clientId: '',
    totalSessions: 10,
    sessionDurationMinutes: 60,
    expiresAt: null,
    notes: '',
  })

  // Adjust package form state
  const [adjustment, setAdjustment] = useState(0)
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustExpiresAt, setAdjustExpiresAt] = useState<string>('')

  // Client detail modal state
  const [showClientDetail, setShowClientDetail] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientBookings, setClientBookings] = useState<BookingWithDetails[]>([])
  const [loadingClientBookings, setLoadingClientBookings] = useState(false)
  const [clientPackageHistory, setClientPackageHistory] = useState<Array<{
    id: string
    clientId: string
    coachId: string
    totalSessions: number
    remainingSessions: number
    sessionDurationMinutes: number
    expiresAt: string | null
    notes: string | null
    createdAt: string
    updatedAt: string
    adjustments: Array<{
      id: string
      packageId: string
      adjustment: number
      previousBalance: number
      newBalance: number
      reason: string | null
      createdAt: string
    }>
  }>>([])
  const [loadingPackageHistory, setLoadingPackageHistory] = useState(false)

  // Packages are already transformed by the API
  const packagesWithClients = packages

  // Filter packages
  const filteredPackages = useMemo(() => {
    let filtered = packagesWithClients

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter((pkg) => {
        const notExpired = !pkg.expiresAt || new Date(pkg.expiresAt) > new Date()
        const hasRemaining = pkg.remainingSessions > 0
        return notExpired && hasRemaining
      })
    } else if (filterStatus === 'expired') {
      filtered = filtered.filter((pkg) => pkg.expiresAt && new Date(pkg.expiresAt) <= new Date())
    } else if (filterStatus === 'depleted') {
      filtered = filtered.filter((pkg) => pkg.remainingSessions === 0)
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter((pkg) =>
        pkg.client?.name?.toLowerCase().includes(search) ||
        pkg.client?.email?.toLowerCase().includes(search)
      )
    }

    return filtered
  }, [packagesWithClients, filterStatus, searchTerm])

  // Group packages by client
  const packagesByClient = useMemo(() => {
    const grouped: Record<string, typeof filteredPackages> = {}
    filteredPackages.forEach((pkg) => {
      const clientId = pkg.clientId
      if (!grouped[clientId]) {
        grouped[clientId] = []
      }
      grouped[clientId].push(pkg)
    })
    return grouped
  }, [filteredPackages])

  // Stats
  const stats = useMemo(() => {
    const activePackages = packagesWithClients.filter((pkg) => {
      const notExpired = !pkg.expiresAt || new Date(pkg.expiresAt) > new Date()
      return notExpired && pkg.remainingSessions > 0
    })
    const totalRemaining = activePackages.reduce((sum, pkg) => sum + pkg.remainingSessions, 0)
    const uniqueClients = new Set(activePackages.map((pkg) => pkg.clientId)).size

    return {
      totalPackages: packagesWithClients.length,
      activePackages: activePackages.length,
      totalRemaining,
      uniqueClients,
    }
  }, [packagesWithClients])

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPackage.clientId) {
      alert('Please select a client')
      return
    }

    const result = await createPackage(newPackage)
    if (result) {
      setShowCreateModal(false)
      setNewPackage({
        clientId: '',
        totalSessions: 10,
        sessionDurationMinutes: 60,
        expiresAt: null,
        notes: '',
      })
    }
  }

  const handleAdjustPackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPackage) return

    // Check if there's any change
    const currentExpiresAt = selectedPackage.expiresAt ? selectedPackage.expiresAt.split('T')[0] : ''
    const expiresAtChanged = adjustExpiresAt !== currentExpiresAt
    const hasAdjustment = adjustment !== 0

    if (!hasAdjustment && !expiresAtChanged) return

    const result = await adjustPackage({
      packageId: selectedPackage.id,
      adjustment,
      reason: adjustReason || undefined,
      expiresAt: expiresAtChanged ? (adjustExpiresAt || null) : undefined,
    })

    if (result) {
      setShowAdjustModal(false)
      setSelectedPackage(null)
      setAdjustment(0)
      setAdjustReason('')
      setAdjustExpiresAt('')
    }
  }

  const openAdjustModal = (pkg: SessionPackage, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPackage(pkg)
    setAdjustment(0)
    setAdjustReason('')
    // Initialize expiration date - format as YYYY-MM-DD for date input
    setAdjustExpiresAt(pkg.expiresAt ? pkg.expiresAt.split('T')[0] : '')
    setShowAdjustModal(true)
  }

  const openClientDetail = async (client: Client) => {
    setSelectedClient(client)
    setShowClientDetail(true)
    setLoadingClientBookings(true)
    setLoadingPackageHistory(true)

    // Fetch bookings
    try {
      const response = await fetch(`/api/bookings?clientId=${client.id}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.warn('Could not fetch bookings for client:', client.id, errorData)
        setClientBookings([])
      } else {
        const data = await response.json()
        const sortedBookings = (data.bookings || []).sort(
          (a: BookingWithDetails, b: BookingWithDetails) =>
            new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
        )
        setClientBookings(sortedBookings)
      }
    } catch (err) {
      console.warn('Error fetching client bookings:', err)
      setClientBookings([])
    } finally {
      setLoadingClientBookings(false)
    }

    // Fetch package history
    try {
      const response = await fetch(`/api/session-packages/history?clientId=${client.id}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.warn('Could not fetch package history for client:', client.id, errorData)
        setClientPackageHistory([])
      } else {
        const data = await response.json()
        setClientPackageHistory(data.packages || [])
      }
    } catch (err) {
      console.warn('Error fetching package history:', err)
      setClientPackageHistory([])
    } finally {
      setLoadingPackageHistory(false)
    }
  }

  const getPackageStatus = (pkg: SessionPackage) => {
    if (pkg.remainingSessions === 0) {
      return { label: 'Depleted', color: 'bg-slate-500/20 text-slate-400' }
    }
    if (pkg.expiresAt && new Date(pkg.expiresAt) <= new Date()) {
      return { label: 'Expired', color: 'bg-red-500/20 text-red-400' }
    }
    if (pkg.remainingSessions <= 2) {
      return { label: 'Low', color: 'bg-amber-500/20 text-amber-400' }
    }
    return { label: 'Active', color: 'bg-green-500/20 text-green-400' }
  }

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions

    if (subscriptionFilterStatus === 'active') {
      filtered = filtered.filter((sub) => sub.isActive)
    } else if (subscriptionFilterStatus === 'paused') {
      filtered = filtered.filter((sub) => !sub.isActive)
    }

    if (subscriptionSearchTerm) {
      const search = subscriptionSearchTerm.toLowerCase()
      filtered = filtered.filter((sub) =>
        sub.client?.name?.toLowerCase().includes(search) ||
        sub.client?.email?.toLowerCase().includes(search)
      )
    }

    return filtered
  }, [subscriptions, subscriptionFilterStatus, subscriptionSearchTerm])

  // Subscription stats
  const subscriptionStats = useMemo(() => {
    const active = subscriptions.filter((sub) => sub.isActive)
    const hybrid = active.filter((sub) => sub.subscriptionType === 'hybrid')
    const onlineOnly = active.filter((sub) => sub.subscriptionType === 'online_only')
    const totalAvailable = hybrid.reduce((sum, sub) => sum + (sub.availableSessions || 0), 0)

    return {
      total: subscriptions.length,
      active: active.length,
      hybrid: hybrid.length,
      onlineOnly: onlineOnly.length,
      totalAvailable,
    }
  }, [subscriptions])

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubscription.clientId) {
      alert('Please select a client')
      return
    }

    setSubscriptionLoading(true)
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubscription),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create subscription')
      }

      const { subscription } = await response.json()
      setSubscriptions((prev) => [subscription, ...prev])
      setShowCreateSubscriptionModal(false)
      setNewSubscription({
        clientId: '',
        subscriptionType: 'hybrid',
        monthlySessions: 4,
        sessionDurationMinutes: 60,
        notes: '',
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create subscription')
    } finally {
      setSubscriptionLoading(false)
    }
  }

  const handleAdjustSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubscription || subscriptionAdjustment === 0) return

    setSubscriptionLoading(true)
    try {
      const response = await fetch(`/api/subscriptions/${selectedSubscription.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustment: subscriptionAdjustment,
          reason: subscriptionAdjustReason || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to adjust subscription')
      }

      const { subscription } = await response.json()
      setSubscriptions((prev) =>
        prev.map((sub) => (sub.id === subscription.id ? subscription : sub))
      )
      setShowAdjustSubscriptionModal(false)
      setSelectedSubscription(null)
      setSubscriptionAdjustment(0)
      setSubscriptionAdjustReason('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to adjust subscription')
    } finally {
      setSubscriptionLoading(false)
    }
  }

  const handleToggleSubscriptionStatus = async (sub: ClientSubscription) => {
    setSubscriptionLoading(true)
    try {
      const response = await fetch(`/api/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !sub.isActive }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update subscription')
      }

      const { subscription } = await response.json()
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subscription.id ? subscription : s))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update subscription')
    } finally {
      setSubscriptionLoading(false)
    }
  }

  const handleDeleteSubscription = async (sub: ClientSubscription) => {
    if (!confirm(`Delete subscription for ${sub.client?.name}? This cannot be undone.`)) return

    setSubscriptionLoading(true)
    try {
      const response = await fetch(`/api/subscriptions/${sub.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete subscription')
      }

      setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete subscription')
    } finally {
      setSubscriptionLoading(false)
    }
  }

  const openAdjustSubscriptionModal = (sub: ClientSubscription, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSubscription(sub)
    setSubscriptionAdjustment(0)
    setSubscriptionAdjustReason('')
    setShowAdjustSubscriptionModal(true)
  }

  const getSubscriptionTypeLabel = (type: SubscriptionType) => {
    return type === 'hybrid' ? 'Hybrid' : 'Online Only'
  }

  const getSubscriptionTypeColor = (type: SubscriptionType) => {
    return type === 'hybrid' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Packages & Subscriptions</h1>
          <p className="text-slate-400 mt-1">Manage client session packages and subscriptions</p>
        </div>
        <Button onClick={() => activeTab === 'packages' ? setShowCreateModal(true) : setShowCreateSubscriptionModal(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {activeTab === 'packages' ? 'New Package' : 'New Subscription'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'packages'
              ? 'text-purple-400 border-purple-500'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          Packages
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-slate-800">{stats.totalPackages}</span>
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'subscriptions'
              ? 'text-purple-400 border-purple-500'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          Subscriptions
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-slate-800">{subscriptionStats.total}</span>
        </button>
      </div>

      {activeTab === 'packages' ? (
        <>
          {/* Stats Bar */}
      <div className="flex items-center gap-6 bg-slate-900/50 rounded-xl border border-slate-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Total:</span>
          <span className="text-white font-semibold">{stats.totalPackages}</span>
        </div>
        <div className="w-px h-6 bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Active:</span>
          <span className="text-green-400 font-semibold">{stats.activePackages}</span>
        </div>
        <div className="w-px h-6 bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Sessions Left:</span>
          <span className="text-purple-400 font-semibold">{stats.totalRemaining}</span>
        </div>
        <div className="w-px h-6 bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Clients:</span>
          <span className="text-blue-400 font-semibold">{stats.uniqueClients}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-xs px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'active', 'depleted', 'expired'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Packages Table */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Client</th>
              <th className="text-center px-6 py-4 text-sm font-medium text-slate-400">Status</th>
              <th className="text-center px-6 py-4 text-sm font-medium text-slate-400">Sessions</th>
              <th className="text-center px-6 py-4 text-sm font-medium text-slate-400">Completed</th>
              <th className="text-center px-6 py-4 text-sm font-medium text-slate-400">Duration</th>
              <th className="text-center px-6 py-4 text-sm font-medium text-slate-400">Expires</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredPackages.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  No packages found
                </td>
              </tr>
            ) : (
              filteredPackages.map((pkg) => {
                const status = getPackageStatus(pkg)
                const completedSessions = completedSessionsByClient[pkg.clientId] || 0
                const client = pkg.client ? {
                  id: pkg.clientId,
                  name: pkg.client.name || 'Unknown',
                  email: pkg.client.email || '',
                  avatar_url: pkg.client.avatarUrl || null,
                } : null
                return (
                  <tr
                    key={pkg.id}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => client && openClientDetail(client)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={pkg.client?.name || 'Unknown'}
                          src={pkg.client?.avatarUrl}
                          size="sm"
                        />
                        <div>
                          <div className="font-medium text-white">{pkg.client?.name || 'Unknown'}</div>
                          <div className="text-sm text-slate-500">{pkg.client?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-white font-semibold">{pkg.remainingSessions}</span>
                      <span className="text-slate-500"> / {pkg.totalSessions}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400 font-medium">{completedSessions}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-300">
                      {pkg.sessionDurationMinutes} min
                    </td>
                    <td className="px-6 py-4 text-center text-slate-400">
                      {pkg.expiresAt
                        ? new Date(pkg.expiresAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => openAdjustModal(pkg, e)}
                        className="text-purple-400 hover:text-purple-300 text-sm font-medium"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      ) : (
        <>
          {/* Subscriptions Stats Bar */}
          <div className="flex items-center gap-6 bg-slate-900/50 rounded-xl border border-slate-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Total:</span>
              <span className="text-white font-semibold">{subscriptionStats.total}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Active:</span>
              <span className="text-green-400 font-semibold">{subscriptionStats.active}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Hybrid:</span>
              <span className="text-purple-400 font-semibold">{subscriptionStats.hybrid}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Online Only:</span>
              <span className="text-blue-400 font-semibold">{subscriptionStats.onlineOnly}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Sessions Available:</span>
              <span className="text-amber-400 font-semibold">{subscriptionStats.totalAvailable}</span>
            </div>
          </div>

          {/* Subscriptions Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search clients..."
                value={subscriptionSearchTerm}
                onChange={(e) => setSubscriptionSearchTerm(e.target.value)}
                className="w-full max-w-xs px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              {(['all', 'active', 'paused'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setSubscriptionFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    subscriptionFilterStatus === status
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Client</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-slate-400">Type</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-slate-400">Sessions</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-slate-400">Duration</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No subscriptions found
                    </td>
                  </tr>
                ) : (
                  filteredSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={sub.client?.name || 'Unknown'}
                            src={sub.client?.avatarUrl}
                            size="sm"
                          />
                          <div>
                            <div className="font-medium text-white flex items-center gap-2">
                              {sub.client?.name || 'Unknown'}
                              {sub.client?.isPending && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">pending</span>
                              )}
                            </div>
                            <div className="text-sm text-slate-500">{sub.client?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getSubscriptionTypeColor(sub.subscriptionType)}`}>
                          {getSubscriptionTypeLabel(sub.subscriptionType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          sub.isActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {sub.isActive ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {sub.subscriptionType === 'hybrid' ? (
                          <>
                            <span className="text-white font-semibold">{sub.availableSessions}</span>
                            <span className="text-slate-500"> / {(sub.monthlySessions || 0) * 2}</span>
                            <div className="text-xs text-slate-500">{sub.monthlySessions}/mo</div>
                          </>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-300">
                        {sub.sessionDurationMinutes ? `${sub.sessionDurationMinutes} min` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {sub.subscriptionType === 'hybrid' && (
                            <button
                              onClick={(e) => openAdjustSubscriptionModal(sub, e)}
                              className="text-purple-400 hover:text-purple-300 text-sm font-medium"
                            >
                              Adjust
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleSubscriptionStatus(sub)}
                            className={`text-sm font-medium ${sub.isActive ? 'text-amber-400 hover:text-amber-300' : 'text-green-400 hover:text-green-300'}`}
                          >
                            {sub.isActive ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => handleDeleteSubscription(sub)}
                            className="text-red-400 hover:text-red-300 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create Package Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Package"
      >
        <form onSubmit={handleCreatePackage} className="space-y-4">
          {/* Client Select */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={newPackage.clientId}
              onChange={(e) => setNewPackage({ ...newPackage, clientId: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email}){client.isPending ? ' - pending' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Sessions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Total Sessions <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={newPackage.totalSessions}
                onChange={(e) => setNewPackage({ ...newPackage, totalSessions: parseInt(e.target.value) || 1 })}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Session Duration <span className="text-red-500">*</span>
              </label>
              <select
                value={newPackage.sessionDurationMinutes}
                onChange={(e) => setNewPackage({ ...newPackage, sessionDurationMinutes: parseInt(e.target.value) })}
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Expiration Date */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Expiration Date (optional)
            </label>
            <input
              type="date"
              value={newPackage.expiresAt || ''}
              onChange={(e) => setNewPackage({ ...newPackage, expiresAt: e.target.value || null })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={newPackage.notes || ''}
              onChange={(e) => setNewPackage({ ...newPackage, notes: e.target.value })}
              rows={3}
              placeholder="Any additional notes about this package..."
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Package
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjust Package Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Adjust Sessions"
      >
        {selectedPackage && (
          <form onSubmit={handleAdjustPackage} className="space-y-4">
            {/* Current Info */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  name={selectedPackage.client?.name || 'Unknown'}
                  src={selectedPackage.client?.avatarUrl}
                  size="sm"
                />
                <div>
                  <div className="font-medium text-white">{selectedPackage.client?.name}</div>
                  <div className="text-sm text-slate-400">{selectedPackage.client?.email}</div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {selectedPackage.remainingSessions}
                  <span className="text-slate-500 text-lg"> / {selectedPackage.totalSessions}</span>
                </div>
                <div className="text-sm text-slate-400 mt-1">sessions remaining</div>
              </div>
            </div>

            {/* Adjustment */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Adjustment
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustment(Math.max(-selectedPackage.remainingSessions, adjustment - 1))}
                  className="w-12 h-12 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center text-xl font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  value={adjustment}
                  onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white text-center text-xl font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setAdjustment(adjustment + 1)}
                  className="w-12 h-12 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center text-xl font-bold"
                >
                  +
                </button>
              </div>
              <div className="text-center mt-2 text-sm">
                {adjustment !== 0 && (
                  <span className={adjustment > 0 ? 'text-green-400' : 'text-red-400'}>
                    New balance: {selectedPackage.remainingSessions + adjustment} sessions
                  </span>
                )}
              </div>
            </div>

            {/* Expiration Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Expiration Date
              </label>
              <input
                type="date"
                value={adjustExpiresAt}
                onChange={(e) => setAdjustExpiresAt(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {adjustExpiresAt && (
                <button
                  type="button"
                  onClick={() => setAdjustExpiresAt('')}
                  className="text-sm text-slate-400 hover:text-slate-300 mt-2"
                >
                  Remove expiration date
                </button>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Reason (optional)
              </label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Makeup session, refund, extended validity, etc."
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowAdjustModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={adjustment === 0 && adjustExpiresAt === (selectedPackage.expiresAt ? selectedPackage.expiresAt.split('T')[0] : '')}
                className="flex-1"
              >
                {adjustment > 0 ? `Add ${adjustment} Sessions` : adjustment < 0 ? `Remove ${Math.abs(adjustment)} Sessions` : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Client Detail Modal */}
      <Modal
        isOpen={showClientDetail}
        onClose={() => {
          setShowClientDetail(false)
          setSelectedClient(null)
          setClientBookings([])
          setClientPackageHistory([])
        }}
        title={selectedClient?.name || 'Client Details'}
      >
        {selectedClient && (
          <div className="space-y-6">
            {/* Client Info */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-700">
              <Avatar
                name={selectedClient.name}
                src={selectedClient.avatar_url}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedClient.name}</h3>
                <p className="text-slate-400">{selectedClient.email}</p>
              </div>
            </div>

            {/* Package Summary */}
            {(() => {
              const clientPkgs = packagesWithClients.filter((p) => p.clientId === selectedClient.id)
              const activePkg = clientPkgs.find((p) => {
                const notExpired = !p.expiresAt || new Date(p.expiresAt) > new Date()
                return notExpired && p.remainingSessions > 0
              })
              const totalRemaining = clientPkgs.reduce((sum, p) => sum + p.remainingSessions, 0)
              const completedCount = completedSessionsByClient[selectedClient.id] || 0

              return (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400">{totalRemaining}</div>
                    <div className="text-sm text-slate-400">Sessions Left</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{completedCount}</div>
                    <div className="text-sm text-slate-400">Completed</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{clientPkgs.length}</div>
                    <div className="text-sm text-slate-400">Packages</div>
                  </div>
                </div>
              )
            })()}

            {/* Session History */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Session History</h4>
              {loadingClientBookings ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : clientBookings.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No sessions found
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(() => {
                    const now = new Date()
                    const upcomingSessions = clientBookings.filter((b) => new Date(b.startsAt) > now && b.status === 'confirmed')
                    const pastSessions = clientBookings.filter((b) => new Date(b.startsAt) <= now || b.status !== 'confirmed')

                    return (
                      <>
                        {/* Upcoming Sessions */}
                        {upcomingSessions.length > 0 && (
                          <>
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-2 mb-1">
                              Upcoming ({upcomingSessions.length})
                            </div>
                            {upcomingSessions.map((booking) => {
                              const startDate = new Date(booking.startsAt)
                              return (
                                <div
                                  key={booking.id}
                                  className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                                    <div>
                                      <div className="text-sm text-white">
                                        {startDate.toLocaleDateString('en-US', {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric',
                                        })}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        {startDate.toLocaleTimeString('en-US', {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                                    {booking.bookingType === 'session' ? 'Training' : 'Check-in'}
                                  </span>
                                </div>
                              )
                            })}
                          </>
                        )}

                        {/* Past Sessions */}
                        {pastSessions.length > 0 && (
                          <>
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-4 mb-1">
                              Past Sessions ({pastSessions.length})
                            </div>
                            {pastSessions.slice(0, 10).map((booking) => {
                              const startDate = new Date(booking.startsAt)
                              const statusColors: Record<string, string> = {
                                completed: 'bg-green-400',
                                confirmed: 'bg-slate-400',
                                cancelled: 'bg-red-400',
                                no_show: 'bg-amber-400',
                              }
                              const statusLabels: Record<string, string> = {
                                completed: 'Completed',
                                confirmed: 'Confirmed',
                                cancelled: 'Cancelled',
                                no_show: 'No Show',
                              }
                              return (
                                <div
                                  key={booking.id}
                                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${statusColors[booking.status] || 'bg-slate-400'}`} />
                                    <div>
                                      <div className="text-sm text-white">
                                        {startDate.toLocaleDateString('en-US', {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric',
                                        })}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        {startDate.toLocaleTimeString('en-US', {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    booking.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                    booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                    booking.status === 'no_show' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-slate-500/20 text-slate-400'
                                  }`}>
                                    {statusLabels[booking.status] || booking.status}
                                  </span>
                                </div>
                              )
                            })}
                            {pastSessions.length > 10 && (
                              <div className="text-center text-sm text-slate-500 pt-2">
                                + {pastSessions.length - 10} more sessions
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Package History */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Package History</h4>
              {loadingPackageHistory ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : clientPackageHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No packages found
                </div>
              ) : (
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {clientPackageHistory.map((pkg) => {
                    const isExpired = pkg.expiresAt && new Date(pkg.expiresAt) <= new Date()
                    const isDepleted = pkg.remainingSessions === 0
                    const statusLabel = isDepleted ? 'Depleted' : isExpired ? 'Expired' : 'Active'
                    const statusColor = isDepleted ? 'bg-slate-500/20 text-slate-400' : isExpired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'

                    return (
                      <div key={pkg.id} className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                        {/* Package Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">
                                {pkg.totalSessions} Session Package
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Purchased {new Date(pkg.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                              {pkg.expiresAt && (
                                <span className="ml-2">
                                  {isExpired ? 'Expired' : 'Expires'} {new Date(pkg.expiresAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-white">
                              {pkg.remainingSessions}
                              <span className="text-slate-500 text-sm font-normal"> / {pkg.totalSessions}</span>
                            </div>
                            <div className="text-xs text-slate-500">remaining</div>
                          </div>
                        </div>

                        {/* Adjustments */}
                        {pkg.adjustments.length > 0 && (
                          <div className="border-t border-slate-700 pt-2">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                              Adjustments
                            </div>
                            <div className="space-y-1">
                              {pkg.adjustments.map((adj) => (
                                <div key={adj.id} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className={adj.adjustment > 0 ? 'text-green-400' : 'text-red-400'}>
                                      {adj.adjustment > 0 ? '+' : ''}{adj.adjustment}
                                    </span>
                                    {adj.reason && (
                                      <span className="text-slate-500 text-xs truncate max-w-[150px]">
                                        {adj.reason}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-slate-500 text-xs">
                                    {new Date(adj.createdAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {pkg.notes && (
                          <div className="border-t border-slate-700 pt-2">
                            <div className="text-xs text-slate-400">{pkg.notes}</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-700">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowClientDetail(false)
                  setSelectedClient(null)
                }}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  // Navigate to bookings page
                  window.location.href = '/coach/bookings'
                }}
                className="flex-1"
              >
                Book Session
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Subscription Modal */}
      <Modal
        isOpen={showCreateSubscriptionModal}
        onClose={() => setShowCreateSubscriptionModal(false)}
        title="Create New Subscription"
      >
        <form onSubmit={handleCreateSubscription} className="space-y-4">
          {/* Client Select */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={newSubscription.clientId}
              onChange={(e) => setNewSubscription({ ...newSubscription, clientId: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email}){client.isPending ? ' - pending' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Subscription Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Subscription Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewSubscription({ ...newSubscription, subscriptionType: 'hybrid' })}
                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                  newSubscription.subscriptionType === 'hybrid'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-white">Hybrid</div>
                <div className="text-sm text-slate-400">Monthly sessions + carryover</div>
              </button>
              <button
                type="button"
                onClick={() => setNewSubscription({ ...newSubscription, subscriptionType: 'online_only' })}
                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                  newSubscription.subscriptionType === 'online_only'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-white">Online Only</div>
                <div className="text-sm text-slate-400">Online coaching subscription</div>
              </button>
            </div>
          </div>

          {/* Hybrid-specific fields */}
          {newSubscription.subscriptionType === 'hybrid' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Monthly Sessions <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={newSubscription.monthlySessions || ''}
                  onChange={(e) => setNewSubscription({ ...newSubscription, monthlySessions: parseInt(e.target.value) || undefined })}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Max carryover: {(newSubscription.monthlySessions || 0) * 2}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Session Duration <span className="text-red-500">*</span>
                </label>
                <select
                  value={newSubscription.sessionDurationMinutes || 60}
                  onChange={(e) => setNewSubscription({ ...newSubscription, sessionDurationMinutes: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={newSubscription.notes || ''}
              onChange={(e) => setNewSubscription({ ...newSubscription, notes: e.target.value })}
              rows={3}
              placeholder="Any additional notes about this subscription..."
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateSubscriptionModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={subscriptionLoading} className="flex-1">
              {subscriptionLoading ? 'Creating...' : 'Create Subscription'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjust Subscription Modal */}
      <Modal
        isOpen={showAdjustSubscriptionModal}
        onClose={() => setShowAdjustSubscriptionModal(false)}
        title="Adjust Sessions"
      >
        {selectedSubscription && (
          <form onSubmit={handleAdjustSubscription} className="space-y-4">
            {/* Current Info */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  name={selectedSubscription.client?.name || 'Unknown'}
                  src={selectedSubscription.client?.avatarUrl}
                  size="sm"
                />
                <div>
                  <div className="font-medium text-white">{selectedSubscription.client?.name}</div>
                  <div className="text-sm text-slate-400">{selectedSubscription.client?.email}</div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {selectedSubscription.availableSessions}
                  <span className="text-slate-500 text-lg"> / {(selectedSubscription.monthlySessions || 0) * 2}</span>
                </div>
                <div className="text-sm text-slate-400 mt-1">sessions available ({selectedSubscription.monthlySessions}/mo)</div>
              </div>
            </div>

            {/* Adjustment */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Adjustment
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSubscriptionAdjustment(Math.max(-(selectedSubscription.availableSessions || 0), subscriptionAdjustment - 1))}
                  className="w-12 h-12 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center text-xl font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  value={subscriptionAdjustment}
                  onChange={(e) => setSubscriptionAdjustment(parseInt(e.target.value) || 0)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white text-center text-xl font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setSubscriptionAdjustment(subscriptionAdjustment + 1)}
                  className="w-12 h-12 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center text-xl font-bold"
                >
                  +
                </button>
              </div>
              <div className="text-center mt-2 text-sm">
                {subscriptionAdjustment !== 0 && (
                  <span className={subscriptionAdjustment > 0 ? 'text-green-400' : 'text-red-400'}>
                    New balance: {Math.min(
                      (selectedSubscription.availableSessions || 0) + subscriptionAdjustment,
                      (selectedSubscription.monthlySessions || 0) * 2
                    )} sessions
                    {(selectedSubscription.availableSessions || 0) + subscriptionAdjustment > (selectedSubscription.monthlySessions || 0) * 2 && (
                      <span className="text-amber-400"> (capped at 2x monthly)</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Reason (optional)
              </label>
              <input
                type="text"
                value={subscriptionAdjustReason}
                onChange={(e) => setSubscriptionAdjustReason(e.target.value)}
                placeholder="e.g., Makeup session, bonus, etc."
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowAdjustSubscriptionModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={subscriptionAdjustment === 0 || subscriptionLoading} className="flex-1">
                {subscriptionLoading ? 'Saving...' : subscriptionAdjustment > 0 ? `Add ${subscriptionAdjustment} Sessions` : subscriptionAdjustment < 0 ? `Remove ${Math.abs(subscriptionAdjustment)} Sessions` : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
