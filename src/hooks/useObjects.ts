import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ObjectItem } from '@/lib/types'

export function useObjects() {
  return useQuery({
    queryKey: ['objects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ObjectItem[]
    },
  })
}

export function useObject(id: string | undefined) {
  return useQuery({
    queryKey: ['objects', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as ObjectItem
    },
  })
}

export function useCreateObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; address: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('objects')
        .insert({ ...input, created_by: user.id })
        .select()
        .single()
      if (error) throw error
      return data as ObjectItem
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['objects'] }),
  })
}

export function useUpdateObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; address: string }) => {
      const { error } = await supabase
        .from('objects')
        .update({ name: input.name, address: input.address })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['objects'] }),
  })
}

export function useDeleteObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('objects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['objects'] }),
  })
}
