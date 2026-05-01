import useSWR, { mutate as globalMutate } from 'swr'
import { workspaceApi } from '@/lib/api/workspace'
import { authApi } from '@/lib/api/auth'
import type { CreditLog, Favorite, FavoriteType, GenerationTask, User } from '@/lib/types'

// ─── localStorage 持久化辅助 ───

function getCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function setCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // localStorage 满了或不可用，静默忽略
  }
}

// ─── 收藏夹 Hook ───

const FAVORITES_KEY = '/favorites'

export function useFavorites(type?: FavoriteType) {
  const swrKey = type ? `${FAVORITES_KEY}?type=${type}` : FAVORITES_KEY
  const cached = getCache<Favorite[]>(swrKey)

  const { data, error, isLoading, isValidating, mutate: swrMutate } = useSWR<Favorite[]>(
    swrKey,
    () => workspaceApi.getFavorites(type),
    {
      fallbackData: cached,
      dedupingInterval: 5000,
      revalidateOnFocus: false,
      onSuccess(data) {
        setCache(swrKey, data)
      },
    },
  )

  return {
    favorites: data ?? [],
    error,
    isLoading,
    isValidating,
    isRefreshing: isValidating && !isLoading,
    hasCache: cached !== undefined,
    refresh: () => swrMutate(),
    mutateFavorites: swrMutate,
  }
}

/** 乐观删除收藏 */
export async function deleteFavoriteOptimistic(id: string) {
  // 对所有 favorites 相关的 key 做乐观更新
  const keys = [FAVORITES_KEY, ...getTypeKeys()]
  for (const key of keys) {
    const cached = getCache<Favorite[]>(key)
    if (cached) {
      globalMutate(key, cached.filter((f) => f.id !== id), false)
    }
  }
  // 后台真正删除
  await workspaceApi.deleteFavorite(id)
  // 删除成功后重新验证
  for (const key of keys) {
    globalMutate(key)
  }
}

function getTypeKeys() {
  return ['clothing', 'model', 'scene', 'full'].map(
    (t) => `${FAVORITES_KEY}?type=${t}`,
  )
}

// ─── 历史记录 Hook ───

const RECORDS_KEY = '/records'

export function useHistoryRecords() {
  const cached = getCache<GenerationTask[]>(RECORDS_KEY)

  const { data, error, isLoading, isValidating, mutate: swrMutate } = useSWR<GenerationTask[]>(
    RECORDS_KEY,
    () => workspaceApi.getRecords(),
    {
      fallbackData: cached,
      dedupingInterval: 5000,
      revalidateOnFocus: false,
      onSuccess(data) {
        setCache(RECORDS_KEY, data)
      },
    },
  )

  return {
    allRecords: data ?? [],
    error,
    isLoading,
    isValidating,
    isRefreshing: isValidating && !isLoading,
    hasCache: cached !== undefined,
    refresh: () => swrMutate(),
    mutateRecords: swrMutate,
  }
}

// ─── 个人中心 Hook ───

const PROFILE_KEY = '/profile/me'
const CREDIT_HISTORY_KEY = '/credits/history'
const GEN_STATS_KEY = '/stats/generation'
const CREDIT_SUMMARY_KEY = '/credits/summary'

export function useProfileMe() {
  const cached = getCache<User>(PROFILE_KEY)

  const { data, error, isLoading, isValidating, mutate: swrMutate } = useSWR<User>(
    PROFILE_KEY,
    () => authApi.getMe(),
    {
      fallbackData: cached,
      dedupingInterval: 10000,
      revalidateOnFocus: false,
      onSuccess(data) {
        setCache(PROFILE_KEY, data)
      },
    },
  )

  return {
    profileUser: data ?? null,
    error,
    isLoading,
    isValidating,
    isRefreshing: isValidating && !isLoading,
    hasCache: cached !== undefined,
    refresh: () => swrMutate(),
    mutateProfile: swrMutate,
  }
}

export interface CreditHistoryData {
  logs: CreditLog[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export function useCreditHistory() {
  const cached = getCache<CreditHistoryData>(CREDIT_HISTORY_KEY)

  const { data, error, isLoading, isValidating, mutate: swrMutate } = useSWR<CreditHistoryData>(
    CREDIT_HISTORY_KEY,
    () => workspaceApi.getCreditHistory(),
    {
      fallbackData: cached,
      dedupingInterval: 10000,
      revalidateOnFocus: false,
      onSuccess(data) {
        setCache(CREDIT_HISTORY_KEY, data)
      },
    },
  )

  return {
    creditData: data ?? null,
    creditLogs: data?.logs ?? [],
    creditPagination: data?.pagination ?? null,
    error,
    isLoading,
    isValidating,
    isRefreshing: isValidating && !isLoading,
    hasCache: cached !== undefined,
    refresh: () => swrMutate(),
    mutateCreditHistory: swrMutate,
  }
}

export interface GenerationStatsData {
  overview: {
    totalTasks: number
    successTasks: number
    failedTasks: number
    pendingTasks: number
    successRate: string
  }
  modelPreferences: {
    gender: Record<string, number>
    bodyType: Record<string, number>
    pose: Record<string, number>
  }
  scenePreferences: {
    preset: Record<string, number>
  }
  dailyStats: Array<{ date: string; total: number; success: number; failed: number }>
}

export function useGenerationStats() {
  const cached = getCache<GenerationStatsData>(GEN_STATS_KEY)

  const { data, error, isLoading, isValidating, mutate: swrMutate } = useSWR<GenerationStatsData>(
    GEN_STATS_KEY,
    () => workspaceApi.getGenerationStats() as Promise<GenerationStatsData>,
    {
      fallbackData: cached,
      dedupingInterval: 30000,
      revalidateOnFocus: false,
      onSuccess(data) {
        setCache(GEN_STATS_KEY, data)
      },
    },
  )

  return {
    genStats: data ?? null,
    error,
    isLoading,
    isValidating,
    isRefreshing: isValidating && !isLoading,
    hasCache: cached !== undefined,
    refresh: () => swrMutate(),
    mutateGenStats: swrMutate,
  }
}

export interface CreditSummaryData {
  totalSpent: number
  totalRecharged: number
  dailyStats: Array<{ date: string; spent: number; recharged: number }>
  typeStats: Record<string, number>
}

export function useCreditSummary() {
  const cached = getCache<CreditSummaryData>(CREDIT_SUMMARY_KEY)

  const { data, error, isLoading, isValidating, mutate: swrMutate } = useSWR<CreditSummaryData>(
    CREDIT_SUMMARY_KEY,
    () => workspaceApi.getCreditSummary(),
    {
      fallbackData: cached,
      dedupingInterval: 30000,
      revalidateOnFocus: false,
      onSuccess(data) {
        setCache(CREDIT_SUMMARY_KEY, data)
      },
    },
  )

  return {
    creditSummary: data ?? null,
    error,
    isLoading,
    isValidating,
    isRefreshing: isValidating && !isLoading,
    hasCache: cached !== undefined,
    refresh: () => swrMutate(),
    mutateCreditSummary: swrMutate,
  }
}
