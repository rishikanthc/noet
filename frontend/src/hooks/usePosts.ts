import { useState, useEffect, useRef, useCallback } from 'react';
import { type Note } from '../types';
import { sortNotes, upsertNote, ensureArray } from '../utils';

export function usePosts(token: string | null) {
	const [posts, setPosts] = useState<Note[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	
	// Stable refs for connection management
	const eventSourceRef = useRef<EventSource | null>(null);
	const currentTokenRef = useRef<string | null>(null);
	const isInitializedRef = useRef(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	// Cleanup function to properly close connections
	const cleanup = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
	}, []);

	// Initial data fetch function
	const fetchInitialData = useCallback(async (authToken: string | null, signal: AbortSignal) => {
		try {
			const res = await fetch("/api/posts", {
				headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
				signal
			});
			
			if (signal.aborted) return;
			
			if (res.ok) {
				const list = await res.json();
				const posts = ensureArray(list);
				const sortedList = sortNotes(posts);
				setPosts(sortedList);
				setError(undefined);
			} else if (res.status >= 500) {
				setError("Failed to load posts");
			} else {
				setPosts([]);
				setError(undefined);
			}
		} catch (e) {
			if (!signal.aborted) {
				console.error("usePosts: Failed to fetch posts", e);
				setError("Failed to load posts");
			}
		} finally {
			if (!signal.aborted) {
				setLoading(false);
			}
		}
	}, []);

	// SSE connection setup
	const setupSSEConnection = useCallback((authToken: string | null) => {
		try {
			// Use absolute URL in production to ensure proper routing through Caddy
			const baseUrl = window.location.origin;
			const streamPath = authToken 
				? `/api/posts/stream?token=${encodeURIComponent(authToken)}` 
				: "/api/posts/stream";
			const streamUrl = `${baseUrl}${streamPath}`;
			
			console.log('usePosts: Attempting SSE connection to:', streamUrl);
			const es = new EventSource(streamUrl);
			eventSourceRef.current = es;

			es.addEventListener("snapshot", (ev: MessageEvent) => {
				try {
					const list: Note[] = JSON.parse(ev.data);
					const posts = ensureArray(list);
					setPosts(sortNotes(posts));
					setError(undefined);
					setLoading(false);
				} catch (e) {
					console.error("usePosts: Failed to parse SSE snapshot data", e);
				}
			});

			es.addEventListener("post-created", (ev: MessageEvent) => {
				try {
					const note: Note = JSON.parse(ev.data);
					setPosts((prev) => upsertNote(prev, note));
				} catch (e) {
					console.error("usePosts: Failed to parse SSE post-created data", e);
				}
			});

			es.addEventListener("post-updated", (ev: MessageEvent) => {
				try {
					const note: Note = JSON.parse(ev.data);
					setPosts((prev) => upsertNote(prev, note));
				} catch (e) {
					console.error("usePosts: Failed to parse SSE post-updated data", e);
				}
			});

			es.addEventListener("post-deleted", (ev: MessageEvent) => {
				try {
					const { id } = JSON.parse(ev.data);
					setPosts((prev) => prev.filter((p) => p.id !== id));
				} catch (e) {
					console.error("usePosts: Failed to parse SSE post-deleted data", e);
				}
			});

			es.addEventListener("error", (event) => {
				console.error("usePosts: SSE connection error:", event);
				console.error("usePosts: EventSource readyState:", es.readyState);
				console.error("usePosts: EventSource url:", es.url);
				
				// If SSE fails, fall back to REST API
				console.warn("usePosts: SSE connection failed, falling back to REST API");
				if (eventSourceRef.current === es) {
					cleanup();
					// Set up a fallback fetch if SSE completely fails
					const controller = new AbortController();
					abortControllerRef.current = controller;
					fetchInitialData(authToken, controller.signal);
				}
			});

			es.addEventListener("open", () => {
				console.log("usePosts: SSE connection opened successfully");
			});

		} catch (e) {
			console.error("usePosts: Failed to initialize SSE connection", e);
			// Fallback to REST API
			const controller = new AbortController();
			abortControllerRef.current = controller;
			fetchInitialData(authToken, controller.signal);
		}
	}, [cleanup, fetchInitialData]);

	// Main effect - handles token changes and connection management
	useEffect(() => {
		console.log('usePosts: Effect triggered, token:', token ? 'present' : 'null');
		console.log('usePosts: isInitialized:', isInitializedRef.current);
		console.log('usePosts: currentToken matches:', currentTokenRef.current === token);
		
		// Only skip if token hasn't changed AND we have an active connection
		if (currentTokenRef.current === token && eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
			console.log('usePosts: Skipping effect - active connection with same token');
			return;
		}

		console.log('usePosts: Proceeding with effect');
		
		// Clean up previous connections
		cleanup();
		
		// Update refs
		currentTokenRef.current = token;
		isInitializedRef.current = true;
		
		// Reset loading state
		setLoading(true);
		setError(undefined);

		// Create abort controller for this effect
		const controller = new AbortController();
		abortControllerRef.current = controller;

		// Start with initial fetch as fallback
		console.log('usePosts: Starting initial fetch');
		fetchInitialData(token, controller.signal).then(() => {
			// Only set up SSE after initial fetch completes (and if not aborted)
			if (!controller.signal.aborted) {
				console.log('usePosts: Initial fetch complete, setting up SSE');
				setupSSEConnection(token);
			} else {
				console.log('usePosts: Initial fetch aborted, skipping SSE setup');
			}
		});

		// Cleanup function - only cleanup if token is actually changing
		return () => {
			console.log('usePosts: Effect cleanup triggered');
			// Only cleanup if we're about to create a new connection with different token
			// Let the component unmount cleanup handle the final cleanup
		};
	}, [token]); // Only depend on token to avoid unnecessary re-runs

	// Component unmount cleanup
	useEffect(() => {
		return cleanup;
	}, [cleanup]);

	const deletePost = useCallback(async (postId: number) => {
		if (!token) return;
		try {
			const res = await fetch(`/api/posts/${postId}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error(`Failed to delete post: ${res.status}`);
			// Remove post from local state immediately for responsive UI
			setPosts((prev) => prev.filter((p) => p.id !== postId));
		} catch (e) {
			alert("Failed to delete post");
		}
	}, [token]);

	const togglePrivacy = useCallback(async (postId: number) => {
		if (!token) return;
		
		try {
			const res = await fetch(`/api/posts/${postId}/publish`, {
				method: 'PUT',
				headers: { Authorization: `Bearer ${token}` },
			});
			
			if (res.ok) {
				const updatedPost = await res.json();
				setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
			}
		} catch (error) {
			console.error("usePosts: Failed to toggle post privacy", { postId, error });
		}
	}, [token]);

	return {
		posts,
		loading,
		error,
		deletePost,
		togglePrivacy,
		setPosts,
	};
}