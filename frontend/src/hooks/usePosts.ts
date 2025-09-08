import { useState, useEffect, useRef, useCallback } from 'react';
import { type Note } from '../types';
import { sortNotes, upsertNote, ensureArray } from '../utils';

export function usePosts(token: string | null) {
	const [posts, setPosts] = useState<Note[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const lastAuthenticatedFetch = useRef<number>(0);

	useEffect(() => {
		console.log("📝 Home Posts useEffect: Starting, token:", !!token);
		let cancelled = false;
		
		const upsert = (list: Note[], item: Note) => upsertNote(list, item);

		// Fallback initial load in case SSE is blocked
		(async () => {
			try {
				console.log("📝 Home Posts: Fetching posts with auth:", !!token);
				const res = await fetch("/api/posts", {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (res.ok) {
					const list = await res.json();
					// Handle null/undefined response
					const posts = ensureArray(list);
					console.log("📝 Home Posts: Received", posts.length, "posts. Private posts:", posts.filter(p => p.isPrivate).length);
					console.log("📝 Home Posts: Post details:", posts.map(p => ({id: p.id, title: p.title, isPrivate: p.isPrivate})));
					if (!cancelled) {
						const sortedList = sortNotes(posts);
						console.log("📝 Home Posts: Setting state with", sortedList.length, "posts. Private in sorted:", sortedList.filter(p => p.isPrivate).length);
						
						// Mark that we just fetched with authentication if we have a token
						if (token) {
							lastAuthenticatedFetch.current = Date.now();
							console.log("📝 Home Posts: Marked authenticated fetch at", lastAuthenticatedFetch.current);
						}
						
						setPosts(sortedList);
					}
				} else {
					console.log("📝 Home Posts: Failed to fetch posts:", res.status);
				}
			} catch (e) {
				console.log("📝 Home Posts: Error fetching posts:", e);
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
					
					console.log("📡 SSE Snapshot: Received", posts.length, "posts. Private:", privatePostsInSnapshot, "Current token:", !!token, "Time since auth fetch:", timeSinceAuthFetch + "ms");
					
					// If we're authenticated and recently fetched data (within 10 seconds) and the snapshot has NO private posts,
					// this means SSE is sending public-only data - reject it
					if (token && timeSinceAuthFetch < 10000 && privatePostsInSnapshot === 0) {
						console.log("📡 SSE Snapshot: REJECTING snapshot (recently fetched authenticated data, but snapshot has no private posts)");
					} else {
						console.log("📡 SSE Snapshot: Accepting snapshot");
						setPosts(sortNotes(posts));
						setError(undefined);
					}
				} catch (e) {
					console.error("snapshot parse error", e);
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
					console.error("create parse error", e);
				}
			});
			es.addEventListener("post-updated", (ev: MessageEvent) => {
				if (cancelled) return;
				try {
					const note: Note = JSON.parse(ev.data);
					setPosts((prev) => upsert(prev, note));
				} catch (e) {
					console.error("update parse error", e);
				}
			});
			es.addEventListener("post-deleted", (ev: MessageEvent) => {
				if (cancelled) return;
				try {
					const { id } = JSON.parse(ev.data);
					setPosts((prev) => prev.filter((p) => p.id !== id));
				} catch (e) {
					console.error("delete parse error", e);
				}
			});
			es.onerror = (e) => {
				console.warn("SSE error", e);
			};
		} catch (e) {
			console.warn("SSE unavailable", e);
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
			console.error(e);
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
			} else {
				console.error('Failed to toggle privacy');
			}
		} catch (error) {
			console.error('Error toggling privacy:', error);
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