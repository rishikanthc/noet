import {
	useEffect,
	useState,
	useRef,
} from "react";
import { Editor, type EditorRef, type MentionItem } from "textforge";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../hooks/useSettings";
import { Header } from "../layout/Header";
import { type Note } from "../../types";

export function AboutMe() {
	const { isAuthenticated, token, logout } = useAuth();
	const { settings } = useSettings();
	const [content, setContent] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [dirty, setDirty] = useState(false);
	const [postMentions, setPostMentions] = useState<MentionItem[]>([]);
	const [mentionsLoaded, setMentionsLoaded] = useState(false);
	const editorRef = useRef<EditorRef>(null);
	const latestContentRef = useRef<string>("");

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

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const res = await fetch(`/api/about`);
				if (!res.ok) throw new Error(`Failed to load about me: ${res.status}`);
				const data = await res.json();
				if (!cancelled) {
					setContent(data.content || "");
					latestContentRef.current = data.content || "";
					setDirty(false);
				}
			} catch (e: any) {
				console.error(e);
				if (!cancelled) setError(e?.message || "Failed to load about me");
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		load();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		// Load post mentions
		const loadPostMentions = async () => {
			try {
				const res = await fetch("/api/posts", {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (res.ok) {
					const posts: Note[] = await res.json();
					// Convert posts to mention items for About Me page
					const mentions: MentionItem[] = posts
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
	}, [token]);

	// If About Me is disabled, show 404-like page
	if (!loading && !settings.aboutEnabled) {
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
					<h1>Page Not Found</h1>
					<p>The page you're looking for doesn't exist.</p>
					<a href="/">← Go back home</a>
				</div>
			</div>
		);
	}

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
				aboutEnabled={settings.aboutEnabled}
			/>
			{dirty && (
				<div className="unsaved-indicator" aria-label="Unsaved changes" />
			)}
			<div className="app-container editor-page">
				<main>
					<div className="editor-wrap">
						<Editor
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
												const res = await fetch(`/api/about`, {
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
													throw new Error(`Failed to save about me: ${res.status}`);
												// Only clear dirty if content hasn't changed since this save started
												if (latestContentRef.current === html) {
													setDirty(false);
												}
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
				</main>
			</div>
		</>
	);
}