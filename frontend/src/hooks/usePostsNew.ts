import { useCallback } from 'react';
import { usePostsQuery, useDeletePost, useTogglePostPrivacy } from './usePostsQuery';

// New posts hook that uses React Query instead of SSE
export function usePosts(token: string | null) {
  const postsQuery = usePostsQuery(token);
  const deletePostMutation = useDeletePost();
  const togglePrivacyMutation = useTogglePostPrivacy();

  const deletePost = useCallback(
    async (postId: number) => {
      if (!token) return;
      
      try {
        await deletePostMutation.mutateAsync({
          id: postId.toString(),
          token,
        });
      } catch (error) {
        console.error('Failed to delete post:', error);
        throw error;
      }
    },
    [token, deletePostMutation]
  );

  const togglePrivacy = useCallback(
    async (postId: number) => {
      if (!token) return;
      
      try {
        await togglePrivacyMutation.mutateAsync({
          id: postId.toString(),
          token,
        });
      } catch (error) {
        console.error('Failed to toggle post privacy:', error);
        throw error;
      }
    },
    [token, togglePrivacyMutation]
  );

  return {
    posts: postsQuery.data || [],
    loading: postsQuery.isLoading,
    error: postsQuery.error?.message,
    deletePost,
    togglePrivacy,
    // For compatibility with existing code
    setPosts: () => {
      // This is handled automatically by React Query
      console.warn('setPosts is deprecated when using React Query');
    },
    // Additional React Query properties that might be useful
    isRefetching: postsQuery.isRefetching,
    refetch: postsQuery.refetch,
  };
}