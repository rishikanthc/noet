import {
	useEffect,
	useState,
	useRef,
	useCallback,
} from "react";
import { type EditorRef, type MentionItem } from "textforge";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../hooks/useSettings";
import { Header } from "../layout/Header";
import { AIEnabledEditor } from "../common/AIEnabledEditor";
import { type Note } from "../../types";

interface PostEditorProps {
	id: string;
}

export function PostEditor({ id }: PostEditorProps) {
	const { isAuthenticated, token, logout } = useAuth();
	const { settings } = useSettings();
	const [content, setContent] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [dirty, setDirty] = useState(false);
	const [creating, setCreating] = useState(false);
	const [postMentions, setPostMentions] = useState<MentionItem[]>([]);
	const [mentionsLoaded, setMentionsLoaded] = useState(false);
	const [backlinks, setBacklinks] = useState<Note[]>([]);
	const [backlinksLoading, setBacklinksLoading] = useState(false);
	const editorRef = useRef<EditorRef>(null);
	const latestContentRef = useRef<string>("");

	const loadBacklinks = useCallback(async () => {
		setBacklinksLoading(true);
		console.log("Loading backlinks for post:", id);
		try {
			const res = await fetch(`/api/posts/${id}/backlinks`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {}
			});
			console.log("Backlinks response status:", res.status);
			if (res.ok) {
				const backlinksData: Note[] = await res.json();
				console.log("Backlinks data:", backlinksData);
				setBacklinks(backlinksData);
			} else {
				console.error("Failed to fetch backlinks:", res.status, res.statusText);
				setBacklinks([]);
			}
		} catch (e) {
			console.error("Failed to load backlinks:", e);
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
			window.location.assign(`/posts/${note.id}`);
		} catch (e) {
			console.error(e);
			alert("Failed to create a new post");
		} finally {
			setCreating(false);
		}
	};

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const res = await fetch(`/api/posts/${id}`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (!res.ok) throw new Error(`Failed to load note: ${res.status}`);
				const note = await res.json();
				if (!cancelled) {
					setContent(note.content || "");
					latestContentRef.current = note.content || "";
					setDirty(false);
				}
			} catch (e: any) {
				console.error(e);
				if (!cancelled) setError(e?.message || "Failed to load note");
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		load();
		return () => {
			cancelled = true;
		};
	}, [id, token]);

	useEffect(() => {
		// Load post mentions
		const loadPostMentions = async () => {
			try {
				const res = await fetch("/api/posts", {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (res.ok) {
					const posts: Note[] = await res.json();
					// Convert posts to mention items, excluding current post
					const mentions: MentionItem[] = posts
						.filter(post => post.id.toString() !== id)
						.map(post => ({
							id: post.id.toString(),
							label: post.title && post.title.trim() ? post.title : `Untitled Post ${post.id}`,
							url: `/posts/${post.id}`
						}));
					setPostMentions(mentions);
				} else {
					console.error("Failed to fetch posts for mentions:", res.status, res.statusText);
					setPostMentions([]);
				}
			} catch (e) {
				console.error("Failed to load posts for mentions:", e);
				setPostMentions([]);
			} finally {
				setMentionsLoaded(true);
			}
		};

		loadPostMentions();
		loadBacklinks();
	}, [id, loadBacklinks, token]);

	if (loading || !mentionsLoaded)
		return (
			<div className="app-container">
				<p>Loading…</p>
			</div>
		);
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
				onSettings={() => window.location.assign("/settings")}
				onNewPost={handleNewPost}
				creating={creating}
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
											setDirty(true);
										}
									: undefined
							}
							onImageUpload={isAuthenticated ? handleImageUpload : undefined}
							onAutoSave={
								isAuthenticated
									? async (html) => {
											try {
												const res = await fetch(`/api/posts/${id}`, {
													method: "PUT",
													headers: {
														"Content-Type": "application/json",
														...(token
															? { Authorization: `Bearer ${token}` }
															: {}),
													},
													body: JSON.stringify({ content: html }),
												});
												if (!res.ok)
													throw new Error(`Failed to save note: ${res.status}`);
												// Only clear dirty if content hasn't changed since this save started
												if (latestContentRef.current === html) {
													setDirty(false);
												}
												// Refresh backlinks after save
												loadBacklinks();
											} catch (e) {
												console.error(e);
												// keep dirty = true so the dot stays visible
											}
										}
									: undefined
							}
							mentions={postMentions || []}
						/>
					</div>
					
					{/* Backlinks section */}
					{console.log("Backlinks render check:", { backlinks, length: backlinks?.length })}
					{backlinks && backlinks.length > 0 && (
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
							<ul style={{ 
								listStyle: "none", 
								margin: 0, 
								padding: 0,
								display: "flex",
								flexDirection: "column",
								gap: "8px"
							}}>
								{(backlinks || []).map((post) => (
									<li key={post.id}>
										<a
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
										</a>
									</li>
								))}
							</ul>
						</div>
					)}
				</main>
			</div>
		</>
	);
}