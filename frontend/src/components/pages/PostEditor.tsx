import {
	useEffect,
	useState,
	useRef,
	useCallback,
	useMemo,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type EditorRef, type MentionItem } from "textforge";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../hooks/useSettings";
import { useUpdatePost, postsQueryKeys } from "../../hooks/usePostsQuery";
import { Header } from "../layout/Header";
import { AIEnabledEditor } from "../common/AIEnabledEditor";
import { type Note } from "../../types";
import { navigateTo } from "../../lib/router";
import { Link } from "../common/Link";
import { getPreloadedData } from "../../lib/preloadedData";

interface PostEditorProps {
	id: string;
}

export function PostEditor({ id }: PostEditorProps) {
	const { isAuthenticated, token, logout, isLoading: authLoading } = useAuth();
	const { settings } = useSettings();
	const updatePostMutation = useUpdatePost();
	const queryClient = useQueryClient();
	const preloaded = getPreloadedData<Record<string, unknown>>();
	const preloadedPost = useMemo(() => {
		const maybePost = preloaded?.post as Note | undefined;
		if (!maybePost) return undefined;
		return String(maybePost.id) === id ? maybePost : undefined;
	}, [preloaded, id]);
	const preloadedAppliedRef = useRef(false);
	const [content, setContent] = useState<string>("");
	const [error, setError] = useState<string | undefined>();
	const [dirty, setDirty] = useState(false);
	const [creating, setCreating] = useState(false);
	const [postMentions, setPostMentions] = useState<MentionItem[]>([]);
	const [backlinks, setBacklinks] = useState<Note[]>([]);
	const [backlinksLoading, setBacklinksLoading] = useState(false);
	const [isInitialLoad, setIsInitialLoad] = useState(true);
	const editorRef = useRef<EditorRef>(null);
	const latestContentRef = useRef<string>("");
	const initialContentRef = useRef<string>("");

	const loadBacklinks = useCallback(async () => {
		setBacklinksLoading(true);
		try {
			const res = await fetch(`/api/posts/${id}/backlinks`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {}
			});
			if (res.ok) {
				const backlinksData: Note[] = await res.json();
				setBacklinks(backlinksData || []);
			} else {
				setBacklinks([]);
			}
		} catch (e) {
			console.error(`[PostEditor] Error loading backlinks:`, e);
			setBacklinks([]);
		} finally {
			setBacklinksLoading(false);
		}
	}, [id, token]);

	const handleImageUpload = async (file: File): Promise<string> => {
		if (!token) {
			throw new Error("Not authenticated");
		}

		const formData = new FormData();
		formData.append("file", file);

		const response = await fetch("/api/uploads", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: formData,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Upload failed: ${errorText}`);
		}

		const data = await response.json();
		return data.url;
	};

	const handleNewPost = async () => {
		if (creating || !isAuthenticated) return;
		setCreating(true);
		try {
			const res = await fetch("/api/posts", {
				method: "POST",
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (!res.ok) throw new Error(`Failed to create note: ${res.status}`);
			const note = await res.json();
			navigateTo(`/posts/${note.id}`);
		} catch (e) {
			console.error("PostEditor: Failed to create new post", e);
			alert("Failed to create a new post");
		} finally {
			setCreating(false);
		}
	};

	useEffect(() => {
		if (!preloadedPost || preloadedAppliedRef.current) {
			return;
		}
		const initialContent = preloadedPost.content || "";
		setContent(initialContent);
		latestContentRef.current = initialContent;
		initialContentRef.current = initialContent;
		setDirty(false);
		preloadedAppliedRef.current = true;
	}, [preloadedPost]);

	useEffect(() => {
		let cancelled = false;

		// Don't load anything if auth is still loading
		if (authLoading) {
			return;
		}

		// Reset initial load state when switching posts
		setIsInitialLoad(true);

		// Load post content immediately (highest priority)
		const loadPostContent = async () => {
			try {
				const response = await fetch(`/api/posts/${id}`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (response.ok) {
					const note = await response.json();
					if (!cancelled) {
						// Update the query cache with the full post data so the title can be used
						queryClient.setQueryData(postsQueryKeys.detail(id), note);

						const initialContent = note.content || "";
						setContent(initialContent);
						latestContentRef.current = initialContent;
						initialContentRef.current = initialContent;
						setDirty(false);
						// Mark initial load as complete after content is set and editor is initialized
						setTimeout(() => setIsInitialLoad(false), 50);
					}
				} else {
					throw new Error(`Failed to load note: ${response.status}`);
				}
			} catch (e: any) {
				console.error("PostEditor: Failed to load post content", e);
				if (!cancelled) setError(e?.message || "Failed to load note");
			}
		};

		// Load post mentions in parallel (for editor functionality)
		const loadPostMentions = async () => {
			const cachedPosts =
				queryClient.getQueryData<Note[]>(postsQueryKeys.list(true)) ??
				queryClient.getQueryData<Note[]>(postsQueryKeys.list(false));

			if (cachedPosts && cachedPosts.length > 0) {
				if (!cancelled) {
					const mentions: MentionItem[] = cachedPosts
						.filter(post => post.id.toString() !== id)
						.map(post => ({
							id: post.id.toString(),
							label: post.title && post.title.trim() ? post.title : `Untitled Post ${post.id}`,
							url: `/posts/${post.id}`,
						}));
					setPostMentions(mentions);
				}
				return;
			}

			try {
				const response = await fetch("/api/posts", {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (response.ok) {
					const posts: Note[] = await response.json();
					if (!cancelled) {
						const mentions: MentionItem[] = posts
							.filter(post => post.id.toString() !== id)
							.map(post => ({
								id: post.id.toString(),
								label: post.title && post.title.trim() ? post.title : `Untitled Post ${post.id}`,
								url: `/posts/${post.id}`,
							}));
						setPostMentions(mentions);
					}
				} else if (!cancelled) {
					setPostMentions([]);
				}
			} catch (e) {
				// Fail silently for mentions - not critical for post display
				if (!cancelled) setPostMentions([]);
			}
		};

		// Start loading content immediately
		loadPostContent();
		// Load mentions in parallel
		loadPostMentions();
		// Load backlinks (lowest priority)
		loadBacklinks();

		return () => {
			cancelled = true;
		};
	}, [id, token, authLoading, loadBacklinks, queryClient]);

	if (authLoading) {
		return (
			<div className="app-container">
				<div>Loading...</div>
			</div>
		);
	}

	if (error)
		return (
			<div className="app-container">
				<p>{error}</p>
			</div>
		);

	return (
		<>
			<Header
				siteTitle={settings.siteTitle}
				isAuthenticated={isAuthenticated}
				onLogout={logout}
				onSettings={() => navigateTo("/settings")}
				onNewPost={handleNewPost}
				creating={creating}
				aboutEnabled={settings.aboutEnabled}
			/>
			{dirty && (
				<div className="unsaved-indicator" aria-label="Unsaved changes" />
			)}
			<div className="app-container editor-page">
				<main>
					<div className="editor-wrap">
						<AIEnabledEditor
							ref={editorRef}
							content={content}
							editable={isAuthenticated}
							onChange={
								isAuthenticated
									? (html) => {
											setContent(html);
											latestContentRef.current = html;
											// Only mark as dirty if this isn't the initial content load
											if (!isInitialLoad) {
												setDirty(true);
											}
										}
									: undefined
							}
							onImageUpload={isAuthenticated ? handleImageUpload : undefined}
							onAutoSave={
								isAuthenticated && token
									? async (html) => {
											// Don't auto-save during initial content load
											if (isInitialLoad) {
												return;
											}
											
											// Don't save if content hasn't actually changed from initial
											if (html === initialContentRef.current) {
												return;
											}
											
											try {
												await updatePostMutation.mutateAsync({
													id,
													content: html,
													token
												});
												// Only clear dirty if content hasn't changed since this save started
												if (latestContentRef.current === html) {
													setDirty(false);
												}
											} catch (e) {
												console.error("PostEditor: Auto-save failed", e);
												// keep dirty = true so the dot stays visible
											}
										}
									: undefined
							}
							mentions={postMentions || []}
						/>
					</div>
					
					{/* Backlinks section */}
					{(backlinksLoading || (backlinks && backlinks.length > 0)) && (
						<div className="backlinks-section" style={{
							maxWidth: 800,
							margin: "48px auto 0",
							padding: "24px",
							borderTop: "1px solid var(--hairline)"
						}}>
							<h3 style={{
								fontSize: "18px",
								fontWeight: 500,
								margin: "0 0 16px",
								color: "#666"
							}}>
								Linked from
							</h3>

							{backlinksLoading && (
								<div style={{
									padding: "16px 0",
									color: "#666",
									fontSize: "14px"
								}}>
									Loading backlinks...
								</div>
							)}

							{!backlinksLoading && (!backlinks || backlinks.length === 0) && (
								<div style={{
									padding: "16px 0",
									color: "#666",
									fontSize: "14px"
								}}>
									No posts link to this one yet.
								</div>
							)}

							{!backlinksLoading && backlinks && backlinks.length > 0 && (
								<ul style={{
									listStyle: "none",
									margin: 0,
									padding: 0,
									display: "flex",
									flexDirection: "column",
									gap: "8px"
								}}>
									{backlinks.map((post) => (
									<li key={post.id}>
										<Link
											href={`/posts/${post.id}`}
											style={{
												color: "#111",
												textDecoration: "none",
												fontSize: "16px",
												display: "block",
												padding: "8px 0",
												borderRadius: "4px",
												transition: "background-color 0.1s ease"
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.backgroundColor = "#f5f5f5";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.backgroundColor = "transparent";
											}}
										>
											{post.title && post.title.trim() ? post.title : "Untitled"}
											{post.updatedAt && (
												<span style={{ 
													color: "#666", 
													fontSize: "14px", 
													marginLeft: "8px"
												}}>
													— {new Date(post.updatedAt).toLocaleDateString(undefined, {
														year: "numeric",
														month: "short",
														day: "numeric",
													})}
												</span>
											)}
										</Link>
									</li>
								))}
								</ul>
							)}
						</div>
					)}
				</main>
			</div>
		</>
	);
}
