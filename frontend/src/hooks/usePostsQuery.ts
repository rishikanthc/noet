import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Note } from '../types';
import { sortNotes, ensureArray } from '../utils';

// Query keys for React Query
export const postsQueryKeys = {
  all: ['posts'] as const,
  lists: () => [...postsQueryKeys.all, 'list'] as const,
  list: (authenticated: boolean) => [...postsQueryKeys.lists(), { authenticated }] as const,
  details: () => [...postsQueryKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...postsQueryKeys.details(), id] as const,
};

// Fetch posts from the API
async function fetchPosts(token: string | null): Promise<Note[]> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  const response = await fetch('/api/posts', { headers, cache: 'no-cache' });
  
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error('Failed to load posts');
    }
    // For client errors, return empty array
    return [];
  }
  
  const data = await response.json();
  const posts = ensureArray(data);
  return sortNotes(posts);
}

// Fetch a single post
async function fetchPost(id: string, token: string | null): Promise<Note> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  const response = await fetch(`/api/posts/${id}`, { headers, cache: 'no-cache' });
  
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'Post not found' : 'Failed to load post');
  }
  
  return response.json();
}

// Create a new post
async function createPost(token: string): Promise<Note> {
  console.log('🚀 createPost: Starting post creation');
  console.log('🚀 createPost: Token present:', !!token);
  console.log('🚀 createPost: User Agent:', navigator.userAgent);
  console.log('🚀 createPost: Current URL:', window.location.href);

  // Firefox CORS fix: Add Content-Type and empty JSON body for consistent CORS handling
  // This ensures Firefox treats this the same as other working POST endpoints like login
  // which also send JSON bodies and work properly in production

  const fetchOptions = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: '{}', // Empty JSON body for consistent CORS handling
    cache: 'no-cache' as RequestCache
  };

  console.log('🚀 createPost: Fetch options:', JSON.stringify(fetchOptions, null, 2));
  console.log('🚀 createPost: About to call fetch...');

  let response: Response;
  try {
    response = await fetch('/api/posts', fetchOptions);
    console.log('🚀 createPost: Fetch completed successfully');
    console.log('🚀 createPost: Response status:', response.status);
    console.log('🚀 createPost: Response ok:', response.ok);
    console.log('🚀 createPost: Response headers:', Object.fromEntries(response.headers.entries()));
  } catch (fetchError) {
    console.error('🔥 createPost: Fetch failed with error:', {
      error: fetchError,
      errorName: fetchError instanceof Error ? fetchError.name : 'Unknown',
      errorMessage: fetchError instanceof Error ? fetchError.message : 'Unknown error',
      errorStack: fetchError instanceof Error ? fetchError.stack : 'No stack',
      userAgent: navigator.userAgent,
      currentUrl: window.location.href
    });
    throw fetchError;
  }

  // Clone response for error handling to avoid double-read issues in Firefox
  console.log('🚀 createPost: Cloning response for Firefox compatibility');
  const responseClone = response.clone();
  console.log('🚀 createPost: Response cloned successfully');

  if (!response.ok) {
    console.error('🔥 createPost: Response not OK, handling error');
    console.log('🚀 createPost: Reading error text from cloned response...');

    let errorText: string;
    try {
      errorText = await responseClone.text();
      console.log('🚀 createPost: Error text read successfully:', errorText);
    } catch (textError) {
      console.error('🔥 createPost: Failed to read error text:', textError);
      errorText = 'Unknown error';
    }

    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: errorText,
      userAgent: navigator.userAgent
    };

    console.error('🔥 createPost: Complete error details:', errorDetails);
    throw new Error(`Failed to create post: ${response.status} - ${errorText}`);
  }

  console.log('🚀 createPost: Response OK, parsing JSON...');

  try {
    console.log('🚀 createPost: About to call responseClone.json()...');
    const result = await responseClone.json();
    console.log('🚀 createPost: JSON parsed successfully:', result);
    console.log('🚀 createPost: Post creation completed successfully!');
    return result;
  } catch (parseError) {
    console.error('🔥 createPost: JSON parsing failed:', {
      parseError,
      errorName: parseError instanceof Error ? parseError.name : 'Unknown',
      errorMessage: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
      errorStack: parseError instanceof Error ? parseError.stack : 'No stack',
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      responseType: response.headers.get('content-type'),
      userAgent: navigator.userAgent
    });

    // Use a fresh clone to get raw text for debugging (Firefox-safe)
    console.log('🚀 createPost: Attempting to read raw response text for debugging...');
    try {
      const debugResponse = response.clone();
      const rawText = await debugResponse.text();
      console.error('🔥 createPost: Raw response body:', rawText);
    } catch (debugError) {
      console.error('🔥 createPost: Could not read raw response text:', debugError);
    }

    throw new Error(`Failed to parse create post response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
  }
}

// Update a post
async function updatePost(id: string, content: string, token: string): Promise<Note> {
  const response = await fetch(`/api/posts/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
    cache: 'no-cache'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update post: ${response.status}`);
  }
  
  return response.json();
}

// Delete a post
async function deletePost(id: string, token: string): Promise<void> {
  const response = await fetch(`/api/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-cache'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete post: ${response.status}`);
  }
}

// Toggle post privacy
async function togglePostPrivacy(id: string, token: string): Promise<Note> {
  console.log('🚀 togglePostPrivacy: Starting privacy toggle for post', id);
  console.log('🚀 togglePostPrivacy: Token present:', !!token);
  console.log('🚀 togglePostPrivacy: User Agent:', navigator.userAgent);

  // Firefox CORS fix: Add Content-Type and empty JSON body for consistent CORS handling
  // This ensures Firefox treats this the same as other working endpoints like createPost
  // which also send JSON bodies and work properly in production

  const fetchOptions = {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: '{}', // Empty JSON body for consistent CORS handling
    cache: 'no-cache' as RequestCache
  };

  console.log('🚀 togglePostPrivacy: Fetch options:', JSON.stringify(fetchOptions, null, 2));
  console.log('🚀 togglePostPrivacy: About to call fetch...');

  let response: Response;
  try {
    response = await fetch(`/api/posts/${id}/publish`, fetchOptions);
    console.log('🚀 togglePostPrivacy: Fetch completed successfully');
    console.log('🚀 togglePostPrivacy: Response status:', response.status);
    console.log('🚀 togglePostPrivacy: Response ok:', response.ok);
    console.log('🚀 togglePostPrivacy: Response headers:', Object.fromEntries(response.headers.entries()));
  } catch (fetchError) {
    console.error('🔥 togglePostPrivacy: Fetch failed with error:', {
      error: fetchError,
      errorName: fetchError instanceof Error ? fetchError.name : 'Unknown',
      errorMessage: fetchError instanceof Error ? fetchError.message : 'Unknown error',
      errorStack: fetchError instanceof Error ? fetchError.stack : 'No stack',
      userAgent: navigator.userAgent,
      currentUrl: window.location.href,
      postId: id
    });
    throw fetchError;
  }

  // Clone response for error handling to avoid double-read issues in Firefox
  console.log('🚀 togglePostPrivacy: Cloning response for Firefox compatibility');
  const responseClone = response.clone();
  console.log('🚀 togglePostPrivacy: Response cloned successfully');

  if (!response.ok) {
    console.error('🔥 togglePostPrivacy: Response not OK, handling error');
    console.log('🚀 togglePostPrivacy: Reading error text from cloned response...');

    let errorText: string;
    try {
      errorText = await responseClone.text();
      console.log('🚀 togglePostPrivacy: Error text read successfully:', errorText);
    } catch (textError) {
      console.error('🔥 togglePostPrivacy: Failed to read error text:', textError);
      errorText = 'Unknown error';
    }

    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: errorText,
      userAgent: navigator.userAgent,
      postId: id
    };

    console.error('🔥 togglePostPrivacy: Complete error details:', errorDetails);
    throw new Error(`Failed to toggle post privacy: ${response.status} - ${errorText}`);
  }

  console.log('🚀 togglePostPrivacy: Response OK, parsing JSON...');

  try {
    console.log('🚀 togglePostPrivacy: About to call responseClone.json()...');
    const result = await responseClone.json();
    console.log('🚀 togglePostPrivacy: JSON parsed successfully:', result);
    console.log('🚀 togglePostPrivacy: Privacy toggle completed successfully!');
    return result;
  } catch (parseError) {
    console.error('🔥 togglePostPrivacy: JSON parsing failed:', {
      parseError,
      errorName: parseError instanceof Error ? parseError.name : 'Unknown',
      errorMessage: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
      errorStack: parseError instanceof Error ? parseError.stack : 'No stack',
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      responseType: response.headers.get('content-type'),
      userAgent: navigator.userAgent,
      postId: id
    });

    // Use a fresh clone to get raw text for debugging (Firefox-safe)
    console.log('🚀 togglePostPrivacy: Attempting to read raw response text for debugging...');
    try {
      const debugResponse = response.clone();
      const rawText = await debugResponse.text();
      console.error('🔥 togglePostPrivacy: Raw response body:', rawText);
    } catch (debugError) {
      console.error('🔥 togglePostPrivacy: Could not read raw response text:', debugError);
    }

    throw new Error(`Failed to parse toggle privacy response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
  }
}

// Hook to fetch all posts
export function usePostsQuery(token: string | null) {
  const isAuthenticated = !!token;
  const queryKey = postsQueryKeys.list(isAuthenticated);
  
  return useQuery({
    queryKey,
    queryFn: () => fetchPosts(token),
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000, // Background refetch every minute
  });
}

// Hook to fetch a single post
export function usePostQuery(id: string, token: string | null) {
  return useQuery({
    queryKey: postsQueryKeys.detail(id),
    queryFn: () => fetchPost(id, token),
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

// Hook to create a new post
export function useCreatePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ token }: { token: string }) => createPost(token),
    onSuccess: (newPost) => {
      // Add the new post to the cache optimistically and sort
      queryClient.setQueryData(
        postsQueryKeys.list(true),
        (oldData: Note[] | undefined) => {
          if (!oldData) return [newPost];
          return sortNotes([newPost, ...oldData]);
        }
      );
      
      // Invalidate posts list to trigger a background refetch
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.lists() });
    },
  });
}

// Hook to update a post
export function useUpdatePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, content, token }: { id: string; content: string; token: string }) =>
      updatePost(id, content, token),
    onSuccess: (updatedPost) => {
      // Update the post in cache
      queryClient.setQueryData(postsQueryKeys.detail(updatedPost.id), updatedPost);
      
      // Update the post in the posts list and ensure proper sorting
      queryClient.setQueryData(
        postsQueryKeys.list(true),
        (oldData: Note[] | undefined) => {
          if (!oldData) return [updatedPost];
          const updatedList = oldData.map((post) =>
            post.id === updatedPost.id ? updatedPost : post
          );
          return sortNotes(updatedList);
        }
      );
      
      // Also update the unauthenticated list if the post is public
      if (!updatedPost.isPrivate) {
        queryClient.setQueryData(
          postsQueryKeys.list(false),
          (oldData: Note[] | undefined) => {
            if (!oldData) return [updatedPost];
            const updatedList = oldData.map((post) =>
              post.id === updatedPost.id ? updatedPost : post
            );
            return sortNotes(updatedList);
          }
        );
      }
      
      // Invalidate posts lists to trigger background refetch
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.lists() });
    },
  });
}

// Hook to delete a post
export function useDeletePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) => deletePost(id, token),
    onSuccess: (_, { id }) => {
      // Remove post from all lists
      queryClient.setQueryData(
        postsQueryKeys.list(true),
        (oldData: Note[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter((post) => post.id !== parseInt(id, 10));
        }
      );
      
      queryClient.setQueryData(
        postsQueryKeys.list(false),
        (oldData: Note[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter((post) => post.id !== parseInt(id, 10));
        }
      );
      
      // Remove post detail from cache
      queryClient.removeQueries({ queryKey: postsQueryKeys.detail(id) });
      
      // Invalidate posts lists to trigger background refetch
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.lists() });
    },
  });
}

// Hook to toggle post privacy
export function useTogglePostPrivacy() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) =>
      togglePostPrivacy(id, token),
    onSuccess: (updatedPost) => {
      // Update the post in cache
      queryClient.setQueryData(postsQueryKeys.detail(updatedPost.id), updatedPost);
      
      // Update the authenticated posts list (no sorting since privacy doesn't change updatedAt)
      queryClient.setQueryData(
        postsQueryKeys.list(true),
        (oldData: Note[] | undefined) => {
          if (!oldData) return [updatedPost];
          return oldData.map((post) =>
            post.id === updatedPost.id ? updatedPost : post
          );
        }
      );
      
      // Handle unauthenticated list - add if public, remove if private
      queryClient.setQueryData(
        postsQueryKeys.list(false),
        (oldData: Note[] | undefined) => {
          if (!oldData) return updatedPost.isPrivate ? [] : [updatedPost];
          
          const filteredData = oldData.filter((post) => post.id !== updatedPost.id);
          
          if (updatedPost.isPrivate) {
            // Post is now private, remove from public list
            return filteredData;
          } else {
            // Post is now public, add to public list
            return sortNotes([...filteredData, updatedPost]);
          }
        }
      );
      
      // Invalidate posts lists
      queryClient.invalidateQueries({ queryKey: postsQueryKeys.lists() });
    },
  });
}
