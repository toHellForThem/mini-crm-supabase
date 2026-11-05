import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

export function useExecutors(enabled = true) {
  return useQuery({
    queryKey: ['profiles', 'executors'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'executor')
        .order('full_name')
      if (error) throw error
      return data as Profile[]
    },
  })
}
