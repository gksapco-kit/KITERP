import { useState } from 'react'
import { Plus, Pencil, Trash2, Building2, ChevronRight } from 'lucide-react'
import { useHRDepartments, useDeleteHRDepartment } from '@/hooks/useVendor'
import { DeptModal } from '@/components/hr/DeptModal'
import type { HRDepartment } from '@/types'

export default function DepartmentsPage() {
  const { data: departments = [], isLoading } = useHRDepartments()
  const deleteDept = useDeleteHRDepartment()
  const [modal, setModal] = useState<{ open: boolean; dept?: HRDepartment | null }>({ open: false })

  const topLevel = (departments as HRDepartment[]).filter((d: HRDepartment) => !d.parent_id)
  const children = (parentId: string) => (departments as HRDepartment[]).filter((d: HRDepartment) => d.parent_id === parentId)

  function handleDelete(dept: HRDepartment) {
    if (!confirm(`Delete department "${dept.name}"?`)) return
    deleteDept.mutate(dept.id)
  }

  function DeptRow({ dept, depth = 0 }: { dept: HRDepartment; depth?: number }) {
    const kids = children(dept.id)
    return (
      <>
        <tr className="border-b hover:bg-gray-50 transition-colors">
          <td className="py-3 px-4">
            <div className="flex items-center gap-2" style={{ paddingLeft: depth * 24 }}>
              {depth > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
              <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="font-medium text-sm">{dept.name}</span>
              {dept.code && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{dept.code}</span>}
            </div>
          </td>
          <td className="py-3 px-4 text-sm text-gray-500">{dept.description || '—'}</td>
          <td className="py-3 px-4">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dept.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {dept.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td className="py-3 px-4 text-right">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setModal({ open: true, dept })}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(dept)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
        {kids.map(child => <DeptRow key={child.id} dept={child} depth={depth + 1} />)}
      </>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Your Organisational Structure</p>
        </div>
        <button
          onClick={() => setModal({ open: true, dept: null })}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : departments.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No departments yet. Create your first one.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {topLevel.map(dept => <DeptRow key={dept.id} dept={dept} />)}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <DeptModal
          dept={modal.dept}
          departments={departments}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
