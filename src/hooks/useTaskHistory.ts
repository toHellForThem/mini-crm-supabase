import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TaskHistory } from '@/lib/types'

export function useTaskHistory(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-history', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_history')
        .select('*, changed_by_profile:changed_by(id, full_name)')
        .eq('task_id', taskId)
        .order('changed_at', { ascending: true })
      if (error) throw error
      return data as unknown as TaskHistory[]
    },
  })
}
