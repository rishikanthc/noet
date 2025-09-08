import { useState, useEffect, useRef, useCallback } from 'react';
import { type Note } from '../types';
import { sortNotes, upsertNote, ensureArray } from '../utils';

export function usePosts(token: string | null) {
	const [posts, setPosts] = useState<Note[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const lastAuthenticatedFetch = useRef<number>(0);

	useEffect(() => {
		let cancelled = false;
		
		const upsert = (list: Note[], item: Note) => upsertNote(list, item);

		// Fallback initial load in case SSE is blocked
		(async () => {
			try {
				const res = await fetch("/api/posts", {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (res.ok) {
					const list = await res.json();
					// Handle null/undefined response
					const posts = ensureArray(list);
					if (!cancelled) {
						const sortedList = sortNotes(posts);
						
						// Mark that we just fetched with authentication if we have a token
						if (token) {
							lastAuthenticatedFetch.current = Date.now();
						}
						
						setPosts(sortedList);
					}
				}
			} catch (e) {
				console.error("usePosts: Failed to fetch posts", e);
			}
		})();

		// Connect to SSE for live updates
		let es: EventSource | undefined;
		try {
			es = new EventSource("/api/posts/stream");
			es.addEventListener("snapshot", (ev: MessageEvent) => {
				if (cancelled) return;
				try {
					const list: Note[] = JSON.parse(ev.data);
					// Handle null/undefined response
					const posts = ensureArray(list);
					const privatePostsInSnapshot = posts.filter(p => p.isPrivate).length;
					const timeSinceAuthFetch = Date.now() - lastAuthenticatedFetch.current;
					
					// If we're authenticated and recently fetched data (within 10 seconds) and the snapshot has NO private posts,
					// this means SSE is sending public-only data - reject it
					if (token && timeSinceAuthFetch < 10000 && privatePostsInSnapshot === 0) {
						// Reject snapshot - recently fetched authenticated data, but snapshot has no private posts
					} else {
						setPosts(sortNotes(posts));
						setError(undefined);
					}
				} catch (e) {
					console.error("usePosts: Failed to parse SSE snapshot data", e);
				} finally {
					setLoading(false);
				}
			});
			es.addEventListener("post-created", (ev: MessageEvent) => {
				if (cancelled) return;
				try {
					const note: Note = JSON.parse(ev.data);
					setPosts((prev) => upsert(prev, note));
				} catch (e) {
					console.error("usePosts: Failed to parse SSE post-created data", e);
				}
			});
			es.addEventListener("post-updated", (ev: MessageEvent) => {
				if (cancelled) return;
				try {
					const note: Note = JSON.parse(ev.data);
					setPosts((prev) => upsert(prev, note));
				} catch (e) {
					console.error("usePosts: Failed to parse SSE post-updated data", e);
				}
			});
			es.addEventListener("post-deleted", (ev: MessageEvent) => {
				if (cancelled) return;
				try {
					const { id } = JSON.parse(ev.data);
					setPosts((prev) => prev.filter((p) => p.id !== id));
				} catch (e) {
					console.error("usePosts: Failed to parse SSE post-deleted data", e);
				}
			});
			es.onerror = (e) => {
				console.error("usePosts: SSE connection error", e);
			};
		} catch (e) {
			console.error("usePosts: Failed to initialize SSE connection", e);
		}

		return () => {
			cancelled = true;
			if (es) es.close();
		};
	}, [token]);

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