import { STATUS_COLORS, STATUS_LABELS, cn } from '@/lib/utils'
import type { TaskStatus } from '@/lib/types'

export default function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
