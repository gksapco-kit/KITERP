import { useState } from 'react'
import { Plus, Pencil, Trash2, Award } from 'lucide-react'
import { useHRDesignations, useDeleteHRDesignation } from '@/hooks/useVendor'
import { DesigModal } from '@/components/hr/DesigModal'
import type { HRDesignation } from '@/types'

export default function DesignationsPage() {
  const { data: designations = [], isLoading } = useHRDesignations()
  const deleteDesig = useDeleteHRDesignation()
  const [modal, setModal] = useState<{ open: boolean; desig?: HRDesignation | null }>({ open: false })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Designations</h1>
          <p className="text-sm text-gray-500 mt-1">Job Titles And Seniority Levels</p>
        </div>
        <button
          onClick={() => setModal({ open: true, desig: null })}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Designation
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : designations.length === 0 ? (
          <div className="p-12 text-center">
            <Award className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No designations yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Level</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {[...designations].sort((a, b) => b.level - a.level).map(desig => (
                <tr key={desig.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary/80" />
                      <span className="font-medium text-sm">{desig.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <span className="font-semibold text-blue-600">L{desig.level}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${desig.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {desig.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setModal({ open: true, desig })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${desig.name}"?`)) deleteDesig.mutate(desig.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <DesigModal desig={modal.desig} onClose={() => setModal({ open: false })} />
      )}
    </div>
  )
}
