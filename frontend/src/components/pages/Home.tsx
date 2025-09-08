import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePosts } from "../../hooks/usePosts";
import { useSettings } from "../../hooks/useSettings";
import { Header } from "../layout/Header";
import { ContextMenu } from "../common/ContextMenu";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { PrivacyToggle } from "../common/PrivacyToggle";
import { type ContextMenuState, type ConfirmDialogState } from "../../types";
import { formatDate } from "../../utils";

export function Home() {
	const { isAuthenticated, logout, token } = useAuth();
	const { posts, loading, error, deletePost, togglePrivacy } = usePosts(token);
	const { settings } = useSettings();
	const [creating, setCreating] = useState(false);
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
	const [togglingPrivacy, setTogglingPrivacy] = useState<number | null>(null);

	const handlePrivacyToggle = useCallback(async (postId: number) => {
		if (!isAuthenticated || !token) return;
		
		setTogglingPrivacy(postId);
		try {
			await togglePrivacy(postId);
		} finally {
			setTogglingPrivacy(null);
		}
	}, [isAuthenticated, token, togglePrivacy]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const k = e.key.toLowerCase();
			if (k === "h") window.location.assign("/");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// Debug logging for posts state changes
	useEffect(() => {
		console.log("📝 Home Posts State: Posts updated. Total:", posts.length, "Private:", posts.filter(p => p.isPrivate).length);
		console.log("📝 Home Posts State: Post IDs:", posts.map(p => `${p.id}(${p.isPrivate ? 'P' : 'Pub'})`));
	}, [posts]);

	const handleNewPost = useCallback(async () => {
		if (creating || !isAuthenticated) return;
		setCreating(true);
		try {
			const res = await fetch("/api/posts", {
				method: "POST",
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (!res.ok) throw new Error(`Failed to create note: ${res.status}`);
			const note = await res.json();
			window.location.assign(`/posts/${note.id}`);
		} catch (e) {
			console.error(e);
			alert("Failed to create a new post");
		} finally {
			setCreating(false);
		}
	}, [creating, isAuthenticated, token]);

	const handleRightClick = useCallback((e: React.MouseEvent, postId: number) => {
		if (!isAuthenticated) return;
		e.preventDefault();
		setContextMenu({ x: e.clientX, y: e.clientY, postId });
	}, [isAuthenticated]);

	const handleDeleteClick = useCallback((postId: number, postTitle: string) => {
		setContextMenu(null);
		setConfirmDialog({ postId, title: postTitle });
	}, []);

	const handleConfirmDelete = useCallback(async () => {
		if (!confirmDialog) return;
		await deletePost(confirmDialog.postId);
		setConfirmDialog(null);
	}, [confirmDialog, deletePost]);

	const debugRender = useMemo(() => {
		console.log("📝 Home Render: About to render. Posts:", posts.length, "Private:", posts.filter(p => p.isPrivate).length, "Loading:", loading, "Error:", error, "IsAuthenticated:", isAuthenticated);
		return null;
	}, [posts.length, posts.filter(p => p.isPrivate).length, loading, error, isAuthenticated]);

	return (
		<div className="home-container">
			<Header
				siteTitle={settings.siteTitle}
				isAuthenticated={isAuthenticated}
				onLogout={logout}
				onSettings={() => window.location.assign("/settings")}
				onNewPost={handleNewPost}
				creating={creating}
				aboutEnabled={settings.aboutEnabled}
			/>
			<div className="home-content">
				<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "48px" }}>
					{settings.heroImage && (
						<img
							src={settings.heroImage}
							alt="Hero image"
							style={{
								width: "150px",
								height: "auto",
								borderRadius: "6px",
								flexShrink: 0,
							}}
						/>
					)}
					<p className="intro-text" style={{ margin: 0, flex: 1 }}>
						{settings.introText && settings.introText.trim()
							? settings.introText
							: "A text‑only blog about design, systems, and quiet craft."}
					</p>
				</div>
				<h1>Latest</h1>
				{loading && <p>Loading…</p>}
				{error && <p>{error}</p>}
				{debugRender}
				{!loading &&
					!error &&
					(posts.length === 0 ? (
						<p>No posts yet.</p>
					) : (
						<ul className="post-list">
							{posts.map((p) => (
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

				{/* Archive link */}
				<div style={{ marginTop: 24, fontSize: 14 }}>
					<a className="header-button" href="/archive">
						View the full archive →
					</a>
				</div>
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