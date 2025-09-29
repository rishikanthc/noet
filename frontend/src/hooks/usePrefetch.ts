import { useQueryClient } from '@tanstack/react-query';
import { postsQueryKeys } from './usePostsQuery';
import { fetchSettings } from './useSettings';

// Hook to prefetch data for instant navigation
export function usePrefetch(token: string | null) {
  const queryClient = useQueryClient();
  
  const prefetchPosts = () => {
    const isAuthenticated = !!token;
    queryClient.prefetchQuery({
      queryKey: postsQueryKeys.list(isAuthenticated),
      queryFn: async () => {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch('/api/posts', { headers });
        if (!response.ok) {
          if (response.status >= 500) {
            throw new Error('Failed to load posts');
          }
          return [];
        }
        return response.json();
      },
      staleTime: 1 * 60 * 1000, // 1 minute
    });
  };

  const prefetchPost = (id: string) => {
    queryClient.prefetchQuery({
      queryKey: postsQueryKeys.detail(id),
      queryFn: async () => {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`/api/posts/${id}`, { headers });
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Post not found' : 'Failed to load post');
        }
        return response.json();
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  const prefetchSettings = () => {
    queryClient.prefetchQuery({
      queryKey: ['settings'],
      queryFn: fetchSettings,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  return {
    prefetchPosts,
    prefetchPost,
    prefetchSettings,
  };
}
