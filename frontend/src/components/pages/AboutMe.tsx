import {
	useEffect,
	useState,
	useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type EditorRef, type MentionItem } from "textforge";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../hooks/useSettings";
import { postsQueryKeys } from "../../hooks/usePostsQuery";
import { Header } from "../layout/Header";
import { AIEnabledEditor } from "../common/AIEnabledEditor";
import { type Note } from "../../types";
import { navigateTo } from "../../lib/router";
import { Link } from "../common/Link";

export function AboutMe() {
	const { isAuthenticated, token, logout } = useAuth();
	const { settings } = useSettings();
	const queryClient = useQueryClient();
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
				console.error("AboutMe: Failed to load about me content", e);
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
		let cancelled = false;

		const applyMentions = (posts: Note[]) => {
			if (cancelled) return;
			setPostMentions(
				posts.map(post => ({
					id: post.id.toString(),
					label: post.title && post.title.trim() ? post.title : `Untitled Post ${post.id}`,
					url: `/posts/${post.id}`,
				}))
			);
			setMentionsLoaded(true);
		};

		const loadPostMentions = async () => {
			const cachedPosts =
				queryClient.getQueryData<Note[]>(postsQueryKeys.list(true)) ??
				queryClient.getQueryData<Note[]>(postsQueryKeys.list(false));

			if (cachedPosts && cachedPosts.length > 0) {
				applyMentions(cachedPosts);
				return;
			}

			try {
				const res = await fetch("/api/posts", {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (res.ok) {
					const posts: Note[] = await res.json();
					applyMentions(posts);
				} else if (!cancelled) {
					setPostMentions([]);
					setMentionsLoaded(true);
				}
			} catch (e) {
				if (!cancelled) {
					console.error("AboutMe: Failed to load post mentions", e);
					setPostMentions([]);
					setMentionsLoaded(true);
				}
			}
		};

		loadPostMentions();

		return () => {
			cancelled = true;
		};
	}, [queryClient, token]);

	// If About Me is disabled, show 404-like page
	if (!loading && !settings.aboutEnabled) {
		return (
			<div className="home-container">
				<Header
					siteTitle={settings.siteTitle}
					isAuthenticated={isAuthenticated}
					onLogout={logout}
					onSettings={() => navigateTo("/settings")}
					aboutEnabled={settings.aboutEnabled}
				/>
				<div className="home-content">
					<h1>Page Not Found</h1>
					<p>The page you're looking for doesn't exist.</p>
					<Link href="/">← Go back home</Link>
				</div>
			</div>
		);
	}

	if ((loading && !content) || !mentionsLoaded)
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
				onSettings={() => navigateTo("/settings")}
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
												console.error("AboutMe: Auto-save failed", e);
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
