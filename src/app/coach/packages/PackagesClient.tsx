'use client'

import { useState, useMemo } from 'react'
import { useSessionPackages } from '@/hooks/useSessionPackages'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { SessionPackage, CreateSessionPackagePayload, BookingWithDetails } from '@/types/booking'

interface Client {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

interface PackagesClientProps {
  clients: Client[]
  completedSessionsByClient: Record<string, number>
}

export function PackagesClient({ clients, completedSessionsByClient }: PackagesClientProps) {
  const { packages, loading, createPackage, adjustPackage } = useSessionPackages()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<SessionPackage | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'depleted'>('all')
  const [searchTerm, setSearchTerm] = useState('')

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

  // Client detail modal state
  const [showClientDetail, setShowClientDetail] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientBookings, setClientBookings] = useState<BookingWithDetails[]>([])
  const [loadingClientBookings, setLoadingClientBookings] = useState(false)

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
    if (!selectedPackage || adjustment === 0) return

    const result = await adjustPackage({
      packageId: selectedPackage.id,
      adjustment,
      reason: adjustReason || undefined,
    })

    if (result) {
      setShowAdjustModal(false)
      setSelectedPackage(null)
      setAdjustment(0)
      setAdjustReason('')
    }
  }

  const openAdjustModal = (pkg: SessionPackage, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPackage(pkg)
    setAdjustment(0)
    setAdjustReason('')
    setShowAdjustModal(true)
  }

  const openClientDetail = async (client: Client) => {
    setSelectedClient(client)
    setShowClientDetail(true)
    setLoadingClientBookings(true)

    try {
      // Use the API endpoint which handles RLS and proper filtering
      const response = await fetch(`/api/bookings?clientId=${client.id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch bookings')
      }
      const data = await response.json()

      // Sort by starts_at descending (most recent first)
      const sortedBookings = (data.bookings || []).sort(
        (a: BookingWithDetails, b: BookingWithDetails) =>
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
      )

      setClientBookings(sortedBookings)
    } catch (err) {
      console.error('Error fetching client bookings:', err)
      setClientBookings([])
    } finally {
      setLoadingClientBookings(false)
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
          <h1 className="text-2xl font-bold text-white">Session Packages</h1>
          <p className="text-slate-400 mt-1">Manage client session packages and track usage</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Package
        </Button>
      </div>

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
                  {client.name} ({client.email})
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

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Reason (optional)
              </label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Makeup session, refund, etc."
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowAdjustModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={adjustment === 0} className="flex-1">
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
    </div>
  )
}
