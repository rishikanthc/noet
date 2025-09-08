import { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../hooks/useSettings";
import { usePosts } from "../../hooks/usePostsNew";
import { Header } from "../layout/Header";
import { ContextMenu } from "../common/ContextMenu";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { PrivacyToggle } from "../common/PrivacyToggle";
import { type Note, type ContextMenuState, type ConfirmDialogState } from "../../types";
import { formatDate, fuzzySearch } from "../../utils";

export function Archive() {
	const { isAuthenticated, logout, token } = useAuth();
	const { settings } = useSettings();
	const { posts, loading, error, deletePost, togglePrivacy } = usePosts(token);
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
	const [togglingPrivacy, setTogglingPrivacy] = useState<number | null>(null);

	const handlePrivacyToggle = useCallback(async (postId: number) => {
		if (!isAuthenticated || !token) return;
		
		setTogglingPrivacy(postId);
		try {
			await togglePrivacy(postId);
		} catch (error) {
			console.error("Archive: Failed to toggle post privacy", { postId, error });
		} finally {
			setTogglingPrivacy(null);
		}
	}, [isAuthenticated, token, togglePrivacy]);

	const handleDeletePost = async (postId: number) => {
		if (!isAuthenticated || !token) return;
		try {
			await deletePost(postId);
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

	const handleConfirmDelete = useCallback(async () => {
		if (!confirmDialog) return;
		await handleDeletePost(confirmDialog.postId);
		setConfirmDialog(null);
	}, [confirmDialog, handleDeletePost]);

	// Filter posts based on search query
	const filteredPosts = useMemo(() => {
		if (!searchQuery.trim()) return posts;
		
		return posts.filter(post => {
			const title = post.title || 'Untitled';
			return fuzzySearch(searchQuery, title);
		});
	}, [posts, searchQuery]);


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