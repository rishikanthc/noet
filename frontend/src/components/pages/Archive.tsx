import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../hooks/useSettings";
import { Header } from "../layout/Header";
import { ContextMenu } from "../common/ContextMenu";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { PrivacyToggle } from "../common/PrivacyToggle";
import { type Note, type ContextMenuState, type ConfirmDialogState } from "../../types";
import { formatDate, fuzzySearch, ensureArray } from "../../utils";

export function Archive() {
	const { isAuthenticated, logout, token } = useAuth();
	const { settings } = useSettings();
	const [posts, setPosts] = useState<Note[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
	const [togglingPrivacy, setTogglingPrivacy] = useState<number | null>(null);

	const handlePrivacyToggle = useCallback(async (postId: number) => {
		if (!isAuthenticated || !token) return;
		
		setTogglingPrivacy(postId);
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
			console.error("Archive: Failed to toggle post privacy", { postId, error });
		} finally {
			setTogglingPrivacy(null);
		}
	}, [isAuthenticated, token]);

	const handleDeletePost = async (postId: number) => {
		if (!isAuthenticated || !token) return;
		try {
			const res = await fetch(`/api/posts/${postId}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error(`Failed to delete post: ${res.status}`);
			// Remove post from local state immediately for responsive UI
			setPosts((prev) => prev.filter((p) => p.id !== postId));
		} catch (e) {
			console.error("Archive: Failed to delete post", { postId, error: e });
			alert("Failed to delete post");
		}
	};

	const handleRightClick = useCallback((e: React.MouseEvent, postId: number) => {
		if (!isAuthenticated) return;
		e.preventDefault();
		setContextMenu({ x: e.clientX, y: e.clientY, postId });
	}, [isAuthenticated]);

	const handleDeleteClick = (postId: number, postTitle: string) => {
		setContextMenu(null);
		setConfirmDialog({ postId, title: postTitle });
	};

	const handleConfirmDelete = async () => {
		if (!confirmDialog) return;
		await handleDeletePost(confirmDialog.postId);
		setConfirmDialog(null);
	};

	// Filter posts based on search query
	const filteredPosts = useMemo(() => {
		if (!searchQuery.trim()) return posts;
		
		return posts.filter(post => {
			const title = post.title || 'Untitled';
			return fuzzySearch(searchQuery, title);
		});
	}, [posts, searchQuery]);

	useEffect(() => {
		const load = async () => {
			try {
				const res = await fetch("/api/posts", {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (res.ok) {
					const list: Note[] = await res.json();
					// Handle null/undefined response
					const posts = ensureArray(list);
					const sorted = [...posts].sort((a, b) => {
						const au = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
						const bu = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
						return bu - au;
					});
					setPosts(sorted);
				} else {
					// Only set error for actual server errors, not empty results
					if (res.status >= 500) {
						setError("Failed to load posts");
					} else {
						// For 4xx errors or empty results, just show empty state
						setPosts([]);
					}
				}
			} catch (e) {
				console.error("Archive: Failed to load posts", e);
				setError("Failed to load posts");
			} finally {
				setLoading(false);
			}
		};
		
		load();
	}, [token]);

	return (
		<div className="home-container">
			<Header
				siteTitle={settings.siteTitle}
				isAuthenticated={isAuthenticated}
				onLogout={logout}
				onSettings={() => window.location.assign("/settings")}
				aboutEnabled={settings.aboutEnabled}
			/>
			<div className="home-content">
				<h1>Archive</h1>
				
				{!loading && !error && (
					<div className="search-container">
						<input
							type="text"
							placeholder="Search posts..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="search-input"
						/>
					</div>
				)}

				{loading && <p>Loading…</p>}
				{error && <p>{error}</p>}
				{!loading &&
					!error &&
					(filteredPosts.length === 0 && searchQuery ? (
						<p>No posts match your search.</p>
					) : filteredPosts.length === 0 ? (
						<p>No posts yet.</p>
					) : (
						<ul className="post-list">
							{filteredPosts.map((p) => (
								<li key={p.id}>
									<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
										{isAuthenticated && (
											<PrivacyToggle
												postId={p.id}
												isPrivate={p.isPrivate}
												onToggle={(id) => {
													// Prevent the link from being followed when clicking privacy toggle
													handlePrivacyToggle(id);
												}}
												isToggling={togglingPrivacy === p.id}
											/>
										)}
										<a
											href={`/posts/${p.id}`}
											className="post-link group"
											onContextMenu={(e) => handleRightClick(e, p.id)}
											style={{ flex: 1 }}
										>
											<span className="post-title group-underline">
												{p.title && p.title.trim() ? p.title : "Untitled"}
											</span>
											{p.updatedAt && (
												<span className="post-meta">
													— {formatDate(p.updatedAt)}
												</span>
											)}
										</a>
									</div>
								</li>
							))}
						</ul>
					))}
			</div>

			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					onDelete={() => {
						const post = posts.find((p) => p.id === contextMenu.postId);
						const title =
							post?.title && post.title.trim() ? post.title : "Untitled";
						handleDeleteClick(contextMenu.postId, title);
					}}
					onClose={() => setContextMenu(null)}
				/>
			)}

			{confirmDialog && (
				<ConfirmDialog
					message={`Are you sure you want to delete "${confirmDialog.title}"?`}
					onConfirm={handleConfirmDelete}
					onCancel={() => setConfirmDialog(null)}
				/>
			)}
		</div>
	);
}