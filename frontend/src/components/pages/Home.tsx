import { useState, useEffect, useCallback, memo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePosts } from "../../hooks/usePostsNew";
import { useSettings } from "../../hooks/useSettings";
import { useCreatePost } from "../../hooks/usePostsQuery";
import { Header } from "../layout/Header";
import { ContextMenu } from "../common/ContextMenu";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { PrivacyToggle } from "../common/PrivacyToggle";
import { type Note, type ContextMenuState, type ConfirmDialogState } from "../../types";
import { formatDate } from "../../utils";
import { navigateTo } from "../../lib/router";
import { Link } from "../common/Link";

export const Home = memo(function Home() {
	const { isAuthenticated, logout, token } = useAuth();
	const { posts, loading, error, deletePost, togglePrivacy } = usePosts(token);
	const { settings } = useSettings();
	const createPostMutation = useCreatePost();
	const [creating, setCreating] = useState(false);
	const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
	const [togglingPrivacy, setTogglingPrivacy] = useState<number | null>(null);
	
	// Show only latest 10 posts on homepage
	const latestPosts = posts.slice(0, 10);

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
			if (k === "h") navigateTo("/");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);


	const handleNewPost = useCallback(async () => {
		if (creating || !isAuthenticated || !token) return;
		setCreating(true);
		try {
			console.log('🏠 Home: Creating new post...');
			console.log('🏠 Home: Browser info:', {
				userAgent: navigator.userAgent,
				isFirefox: navigator.userAgent.toLowerCase().includes('firefox'),
				currentUrl: window.location.href
			});
			console.log('🏠 Home: About to call createPostMutation.mutateAsync...');

			const note = await createPostMutation.mutateAsync({ token });

			console.log('🏠 Home: Post created successfully, navigating to:', `/posts/${note.id}`);
			navigateTo(`/posts/${note.id}`);
		} catch (e) {
			console.error("🔥 Home: Failed to create new post", {
				error: e,
				errorName: e instanceof Error ? e.name : 'Unknown',
				errorMessage: e instanceof Error ? e.message : 'Unknown error',
				errorStack: e instanceof Error ? e.stack : undefined,
				errorString: String(e),
				errorType: typeof e,
				token: token ? 'present' : 'missing',
				isAuthenticated,
				userAgent: navigator.userAgent,
				isFirefox: navigator.userAgent.toLowerCase().includes('firefox'),
				currentUrl: window.location.href
			});

			// Also log the raw error object to see all its properties
			console.error("🔥 Home: Raw error object:", e);

			alert(`Failed to create a new post: ${e instanceof Error ? e.message : 'Unknown error'}`);
		} finally {
			setCreating(false);
		}
	}, [creating, isAuthenticated, token, createPostMutation]);

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


	return (
		<div className="home-container">
			<Header
				siteTitle={settings.siteTitle}
				isAuthenticated={isAuthenticated}
				onLogout={logout}
				onSettings={() => navigateTo("/settings")}
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
				{loading && latestPosts.length === 0 && <p>Loading…</p>}
				{error && <p>{error}</p>}
				{!loading &&
					!error &&
					(latestPosts.length === 0 ? (
						<p>No posts yet.</p>
					) : (
						<ul className="post-list">
							{latestPosts.map((p) => (
								<li key={p.id}>
									<div style={{ display: "flex", alignItems: "center", gap: "8px" }} onContextMenu={(e) => handleRightClick(e, p.id)}>
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
										<Link
											href={`/posts/${p.id}`}
											className="post-link group"
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
										</Link>
									</div>
								</li>
							))}
						</ul>
					))}

				{/* Archive link */}
				<div style={{ marginTop: 24, fontSize: 14 }}>
					<Link className="header-button" href="/archive">
						View the full archive →
					</Link>
				</div>
			</div>

			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					onDelete={() => {
						const post = latestPosts.find((p) => p.id === contextMenu.postId);
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
});