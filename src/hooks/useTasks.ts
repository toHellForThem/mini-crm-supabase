import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, TaskStatus } from '@/lib/types'

const TASK_SELECT =
  '*, assignee:assignee_id(id, full_name), author:author_id(id, full_name), object:object_id(id, name)'

export function useTasks(filter?: { objectId?: string; assigneeId?: string }) {
  return useQuery({
    queryKey: ['tasks', filter?.objectId ?? 'all', filter?.assigneeId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('tasks').select(TASK_SELECT)
      if (filter?.objectId) query = query.eq('object_id', filter.objectId)
      if (filter?.assigneeId) query = query.eq('assignee_id', filter.assigneeId)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as Task[]
    },
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as Task
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      title: string
      description: string
      object_id: string
      assignee_id: string
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: input.title,
          description: input.description || null,
          object_id: input.object_id,
          assignee_id: input.assignee_id,
          author_id: user.id,
          status: 'new',
        })
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      title: string
      description: string
      assignee_id: string
    }) => {
      // Status is intentionally NOT part of this update:
      // status changes must go through update_task_status() RPC.
      const { error } = await supabase
        .from('tasks')
        .update({
          title: input.title,
          description: input.description || null,
          assignee_id: input.assignee_id,
        })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.id] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      taskId: string
      newStatus: TaskStatus
      comment?: string
    }) => {
      const { error } = await supabase.rpc('update_task_status', {
        p_task_id: input.taskId,
        p_new_status: input.newStatus,
        p_comment: input.comment ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-history', variables.taskId] })
    },
  })
}
