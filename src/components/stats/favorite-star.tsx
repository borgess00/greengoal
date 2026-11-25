import { Link, useLocation } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { errorMessage } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getFavoriteTeams, toggleFavoriteTeam } from '@/server/favorites.functions'

export function useFavoriteTeams() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['favorite-teams', user?.id], queryFn: () => getFavoriteTeams(), enabled: !!user, staleTime: 5 * 60_000 })
}

/** Estrela para seguir um time. Sem login, leva para a tela de entrar. */
export function FavoriteStar({ teamId, teamName, teamLogo, className }: { teamId: number; teamName: string; teamLogo: string | null; className?: string }) {
  const { user } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const favs = useFavoriteTeams()
  const on = !!favs.data?.teams.some((t) => t.team_id === teamId)
  const toggle = useMutation({
    mutationFn: () => toggleFavoriteTeam({ data: { teamId, teamName, teamLogo, on: !on } }),
    onSuccess: () => {
      toast.success(on ? `${teamName} saiu dos favoritos.` : `${teamName} está nos seus favoritos.`)
      queryClient.invalidateQueries({ queryKey: ['favorite-teams'] })
      queryClient.invalidateQueries({ queryKey: ['favorite-fixtures'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const base = cn('grid size-9 place-items-center rounded-full border border-white/30 bg-white/10 text-white transition hover:bg-white/25', className)
  if (!user) {
    return (
      <Link to="/auth" search={{ redirect: location.href }} className={base} aria-label={`Entre para favoritar ${teamName}`} title="Entre para favoritar">
        <Star className="size-4" />
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={base}
      onClick={() => toggle.mutate()}
      disabled={toggle.isPending || favs.isLoading}
      aria-pressed={on}
      aria-label={on ? `Remover ${teamName} dos favoritos` : `Adicionar ${teamName} aos favoritos`}
      title={on ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    >
      <Star className={cn('size-4', on && 'fill-yellow-300 text-yellow-300')} />
    </button>
  )
}
