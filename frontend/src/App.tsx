import {
	useEffect,
	useMemo,
	useRef,
	useState,
	createContext,
	useContext,
	useCallback,
} from "react";
import { Editor, type EditorRef, type MentionItem, getPresetById } from "textforge";
import "./styles.css";
import { PrivacyToggle } from "./PrivacyToggle";

type Note = {
	id: number;
	title?: string;
	content?: string;
	createdAt?: string;
	updatedAt?: string;
	isPrivate: boolean;
};

type User = {
	id: number;
	username: string;
};

type AuthContextType = {
	user: User | null;
	token: string | null;
	login: (username: string, password: string) => Promise<boolean>;
	register: (username: string, password: string) => Promise<boolean>;
	logout: () => void;
	isAuthenticated: boolean;
	refreshToken: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);

	useEffect(() => {
		console.log("🔐 Auth useEffect: Starting authentication check");
		// Check for existing tokens in localStorage
		const savedToken = localStorage.getItem("auth_token");
		const savedRefreshToken = localStorage.getItem("refresh_token");
		console.log("🔐 Auth useEffect: savedToken exists:", !!savedToken, "savedRefreshToken exists:", !!savedRefreshToken);
		
		if (savedToken) {
			console.log("🔐 Auth useEffect: Validating token...");
			// Validate token
			fetch("/api/auth/validate", {
				headers: { Authorization: `Bearer ${savedToken}` },
			})
				.then((res) => res.json())
				.then((data) => {
					console.log("🔐 Auth useEffect: Token validation result:", data.valid);
					if (data.valid) {
						console.log("🔐 Auth useEffect: Setting authenticated state");
						setToken(savedToken);
						setUser(data.user);
						if (savedRefreshToken) {
							setRefreshTokenValue(savedRefreshToken);
						}
					} else {
						// Token expired, try refresh if we have refresh token
						if (savedRefreshToken) {
							attemptRefresh(savedRefreshToken);
						} else {
							// No refresh token, clear everything
							localStorage.removeItem("auth_token");
							localStorage.removeItem("refresh_token");
						}
					}
				})
				.catch(() => {
					// Error validating, try refresh if we have refresh token
					if (savedRefreshToken) {
						attemptRefresh(savedRefreshToken);
					} else {
						localStorage.removeItem("auth_token");
						localStorage.removeItem("refresh_token");
					}
				});
		}
	}, []);

	const attemptRefresh = async (refreshToken: string) => {
		try {
			const res = await fetch("/api/auth/refresh", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken }),
			});

			if (res.ok) {
				const data = await res.json();
				setToken(data.token);
				setUser(data.user);
				setRefreshTokenValue(data.refreshToken);
				localStorage.setItem("auth_token", data.token);
				localStorage.setItem("refresh_token", data.refreshToken);
			} else {
				// Refresh failed, clear everything
				localStorage.removeItem("auth_token");
				localStorage.removeItem("refresh_token");
			}
		} catch {
			localStorage.removeItem("auth_token");
			localStorage.removeItem("refresh_token");
		}
	};

	const login = async (
		username: string,
		password: string,
	): Promise<boolean> => {
		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});

			if (res.ok) {
				const data = await res.json();
				setToken(data.token);
				setUser(data.user);
				setRefreshTokenValue(data.refreshToken);
				localStorage.setItem("auth_token", data.token);
				localStorage.setItem("refresh_token", data.refreshToken);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	};

	const logout = () => {
		setToken(null);
		setUser(null);
		setRefreshTokenValue(null);
		localStorage.removeItem("auth_token");
		localStorage.removeItem("refresh_token");
	};

	const register = async (
		username: string,
		password: string,
	): Promise<boolean> => {
		try {
			const res = await fetch("/api/setup/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});

			if (res.ok) {
				const data = await res.json();
				setToken(data.token);
				setUser(data.user);
				setRefreshTokenValue(data.refreshToken);
				localStorage.setItem("auth_token", data.token);
				localStorage.setItem("refresh_token", data.refreshToken);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	};

	const refreshToken = async (): Promise<boolean> => {
		if (!refreshTokenValue) return false;
		
		try {
			const res = await fetch("/api/auth/refresh", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken: refreshTokenValue }),
			});

			if (res.ok) {
				const data = await res.json();
				setToken(data.token);
				setUser(data.user);
				setRefreshTokenValue(data.refreshToken);
				localStorage.setItem("auth_token", data.token);
				localStorage.setItem("refresh_token", data.refreshToken);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				login,
				register,
				logout,
				isAuthenticated: !!token && !!user,
				refreshToken,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

function Registration() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const { register } = useAuth();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!username || !password || !confirmPassword) {
			setError("Please fill in all fields");
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		if (password.length < 3) {
			setError("Password must be at least 3 characters");
			return;
		}

		setLoading(true);
		setError("");

		const success = await register(username, password);
		if (success) {
			window.location.assign("/");
		} else {
			setError("Registration failed. Please try again.");
			setLoading(false);
		}
	};

	return (
		<div className="login-container">
			<div className="login-content">
				<h1>Create Admin Account</h1>
				<p
					style={{
						marginBottom: "24px",
						color: "#666",
						textAlign: "center",
						fontSize: "14px",
					}}
				>
					Set up your admin account to get started
				</p>
				<form onSubmit={handleSubmit} className="login-form">
					{error && <div className="error-message">{error}</div>}
					<div className="form-group">
						<label htmlFor="username">Username</label>
						<input
							type="text"
							id="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							disabled={loading}
							autoFocus
							placeholder="Enter your username"
						/>
					</div>
					<div className="form-group">
						<label htmlFor="password">Password</label>
						<input
							type="password"
							id="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={loading}
							placeholder="Enter your password"
						/>
					</div>
					<div className="form-group">
						<label htmlFor="confirmPassword">Confirm Password</label>
						<input
							type="password"
							id="confirmPassword"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							disabled={loading}
							placeholder="Confirm your password"
						/>
					</div>
					<button type="submit" className="login-button" disabled={loading}>
						{loading ? "Creating Account..." : "Create Account"}
					</button>
				</form>
			</div>
		</div>
	);
}

function Login() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const { login } = useAuth();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!username || !password) {
			setError("Please fill in all fields");
			return;
		}

		setLoading(true);
		setError("");

		const success = await login(username, password);
		if (success) {
			window.location.assign("/");
		} else {
			setError("Invalid credentials");
			setLoading(false);
		}
	};

	return (
		<div className="login-container">
			<div className="login-content">
				<h1>Admin Login</h1>
				<form onSubmit={handleSubmit} className="login-form">
					{error && <div className="error-message">{error}</div>}
					<div className="form-group">
						<label htmlFor="username">Username</label>
						<input
							type="text"
							id="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							disabled={loading}
							autoFocus
						/>
					</div>
					<div className="form-group">
						<label htmlFor="password">Password</label>
						<input
							type="password"
							id="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={loading}
						/>
					</div>
					<button type="submit" className="login-button" disabled={loading}>
						{loading ? "Signing In..." : "Sign In"}
					</button>
				</form>
			</div>
		</div>
	);
}

function Header({
	siteTitle,
	isAuthenticated,
	onLogout,
	onSettings,
	onNewPost,
	creating,
	aboutEnabled,
}: {
	siteTitle: string;
	isAuthenticated: boolean;
	onLogout: () => void;
	onSettings: () => void;
	onNewPost?: () => void;
	creating?: boolean;
	aboutEnabled?: boolean;
}) {
	const path = typeof window !== "undefined" ? window.location.pathname : "/";
	return (
		<header className="site-header">
			<div className="site-header-content">
				<a href="/" className={`site-title ${!siteTitle ? "empty" : ""}`}>
					{siteTitle || "Untitled Site"}
				</a>
				<div className="header-actions" role="navigation" aria-label="Primary">
					<a
						className={`header-button ${path === "/" ? "active" : ""}`}
						href="/"
					>
						Home
					</a>
					<a
						className={`header-button ${path === "/archive" ? "active" : ""}`}
						href="/archive"
					>
						Archive
					</a>
					{aboutEnabled && (
						<a
							className={`header-button ${path === "/about" ? "active" : ""}`}
							href="/about"
						>
							About Me
						</a>
					)}
					<a className="header-button" href="/rss.xml">
						RSS
					</a>
					{isAuthenticated && (
						<>
							<button className="header-button" onClick={onSettings}>
								Settings
							</button>
							{onNewPost && (
								<button
									className="header-button"
									onClick={onNewPost}
									disabled={creating}
								>
									{creating ? "Creating..." : "New Post"}
								</button>
							)}
							<button className="header-button" onClick={onLogout}>
								Logout
							</button>
						</>
					)}
				</div>
			</div>
		</header>
	);
}

function ContextMenu({
	x,
	y,
	onDelete,
	onClose,
}: { x: number; y: number; onDelete: () => void; onClose: () => void }) {
	useEffect(() => {
		const handleClickOutside = () => onClose();
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("click", handleClickOutside);
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("click", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [onClose]);

	return (
		<div
			className="context-menu"
			style={{ left: x, top: y }}
			onMouseDown={(e) => e.stopPropagation()}
		>
			<button
				className="context-menu-item delete-item"
				onClick={(e) => {
					e.stopPropagation();
					onDelete();
				}}
			>
				Delete
			</button>
		</div>
	);
}

function ConfirmDialog({
	message,
	onConfirm,
	onCancel,
}: { message: string; onConfirm: () => void; onCancel: () => void }) {
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [onCancel]);

	return (
		<div className="dialog-overlay">
			<div className="dialog-content">
				<p className="dialog-message">{message}</p>
				<div className="dialog-actions">
					<button className="dialog-button confirm-button" onClick={onConfirm}>
						Delete
					</button>
					<button className="dialog-button cancel-button" onClick={onCancel}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

function Home() {
	const { isAuthenticated, logout, token } = useAuth();
	const [posts, setPosts] = useState<Note[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	
	// Ref to track if we've recently fetched authenticated posts
	const lastAuthenticatedFetch = useRef<number>(0);
	
	// Debug logging for posts state changes
	useEffect(() => {
		console.log("📝 Home Posts State: Posts updated. Total:", posts.length, "Private:", posts.filter(p => p.isPrivate).length);
		console.log("📝 Home Posts State: Post IDs:", posts.map(p => `${p.id}(${p.isPrivate ? 'P' : 'Pub'})`));
	}, [posts]);
	const [intro, setIntro] = useState<string>("");
	const [siteTitle, setSiteTitle] = useState<string>("");
	const [heroImage, setHeroImage] = useState<string>("");
	const [aboutEnabled, setAboutEnabled] = useState<boolean>(false);
	const [creating, setCreating] = useState(false);
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		postId: number;
	} | null>(null);
	const [confirmDialog, setConfirmDialog] = useState<{
		postId: number;
		title: string;
	} | null>(null);
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
			} else {
				console.error('Failed to toggle privacy');
			}
		} catch (error) {
			console.error('Error toggling privacy:', error);
		} finally {
			setTogglingPrivacy(null);
		}
	}, [isAuthenticated, token]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const k = e.key.toLowerCase();
			if (k === "h") window.location.assign("/");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		console.log("📝 Home Posts useEffect: Starting, token:", !!token);
		let cancelled = false;
		const sortNotes = (arr: Note[]) =>
			[...arr].sort((a, b) => {
				const au = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
				const bu = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
				if (bu !== au) return bu - au;
				const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return bc - ac;
			});
		const upsert = (list: Note[], item: Note) => {
			const idx = list.findIndex((n) => n.id === item.id);
			if (idx === -1) return sortNotes([item, ...list]);
			const next = list.slice();
			next[idx] = { ...next[idx], ...item };
			return sortNotes(next);
		};

		// Fallback initial load in case SSE is blocked
		(async () => {
			try {
				console.log("📝 Home Posts: Fetching posts with auth:", !!token);
				const res = await fetch("/api/posts", {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (res.ok) {
					const list = await res.json();
					console.log("📝 Home Posts: Received", list.length, "posts. Private posts:", list.filter(p => p.isPrivate).length);
					console.log("📝 Home Posts: Post details:", list.map(p => ({id: p.id, title: p.title, isPrivate: p.isPrivate})));
					if (!cancelled) {
						const sortedList = sortNotes(list);
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
					const privatePostsInSnapshot = list.filter(p => p.isPrivate).length;
					const timeSinceAuthFetch = Date.now() - lastAuthenticatedFetch.current;
					
					console.log("📡 SSE Snapshot: Received", list.length, "posts. Private:", privatePostsInSnapshot, "Current token:", !!token, "Time since auth fetch:", timeSinceAuthFetch + "ms");
					
					// If we're authenticated and recently fetched data (within 10 seconds) and the snapshot has NO private posts,
					// this means SSE is sending public-only data - reject it
					if (token && timeSinceAuthFetch < 10000 && privatePostsInSnapshot === 0) {
						console.log("📡 SSE Snapshot: REJECTING snapshot (recently fetched authenticated data, but snapshot has no private posts)");
					} else {
						console.log("📡 SSE Snapshot: Accepting snapshot");
						setPosts(sortNotes(list));
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

	useEffect(() => {
		// Load settings from API
		const loadSettings = async () => {
			try {
				const res = await fetch("/api/settings");
				if (res.ok) {
					const data = await res.json();
					setIntro(data.introText || "");
					setSiteTitle(data.siteTitle || "");
					setHeroImage(data.heroImage || "");
					setAboutEnabled(data.aboutEnabled === "true");
				}
			} catch (e) {
				console.error("Failed to load settings:", e);
			}
		};
		loadSettings();
	}, []);

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
			console.error(e);
			alert("Failed to delete post");
		}
	};

	const handleRightClick = (e: React.MouseEvent, postId: number) => {
		if (!isAuthenticated) return;
		e.preventDefault();
		setContextMenu({ x: e.clientX, y: e.clientY, postId });
	};

	const handleDeleteClick = (postId: number, postTitle: string) => {
		setContextMenu(null);
		setConfirmDialog({ postId, title: postTitle });
	};

	const handleConfirmDelete = async () => {
		if (!confirmDialog) return;
		await handleDeletePost(confirmDialog.postId);
		setConfirmDialog(null);
	};

	return (
		<div className="home-container">
			<Header
				siteTitle={siteTitle}
				isAuthenticated={isAuthenticated}
				onLogout={logout}
				onSettings={() => window.location.assign("/settings")}
				onNewPost={handleNewPost}
				creating={creating}
				aboutEnabled={aboutEnabled}
			/>
			<div className="home-content">
				<div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "48px" }}>
					{heroImage && (
						<img
							src={heroImage}
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
						{intro && intro.trim()
							? intro
							: "A text‑only blog about design, systems, and quiet craft."}
					</p>
				</div>
				<h1>Latest</h1>
				{loading && <p>Loading…</p>}
				{error && <p>{error}</p>}
				{(() => {
					console.log("📝 Home Render: About to render. Posts:", posts.length, "Private:", posts.filter(p => p.isPrivate).length, "Loading:", loading, "Error:", error, "IsAuthenticated:", isAuthenticated);
					return null;
				})()}
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
													—{" "}
													{new Date(p.updatedAt).toLocaleDateString(undefined, {
														year: "numeric",
														month: "long",
														day: "numeric",
													})}
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

function Settings() {
	const { isAuthenticated, token, logout } = useAuth();
	const [introText, setIntroText] = useState<string>("");
	const [siteTitle, setSiteTitle] = useState<string>("");
	const [heroImage, setHeroImage] = useState<string>("");
	const [aboutEnabled, setAboutEnabled] = useState<boolean>(false);
	const [uploading, setUploading] = useState(false);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const loadSettings = async () => {
			try {
				// Load all settings
				const res = await fetch("/api/settings");
				if (res.ok) {
					const data = await res.json();
					setIntroText(data.introText || "");
					setSiteTitle(data.siteTitle || "");
					setHeroImage(data.heroImage || "");
					setAboutEnabled(data.aboutEnabled === "true");
				}
			} catch (e) {
				console.error("Failed to load settings:", e);
			} finally {
				setLoading(false);
			}
		};
		loadSettings();
	}, []);

	const handleImageUpload = async (file: File) => {
		if (!isAuthenticated || !token) return;
		setUploading(true);

		try {
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
			setHeroImage(data.url);
		} catch (e) {
			console.error("Image upload error:", e);
			alert(`Failed to upload image: ${e.message}`);
		} finally {
			setUploading(false);
		}
	};

	const handleSave = async () => {
		if (!isAuthenticated || !token) return;
		setSaving(true);

		try {
			console.log("Saving settings...", { introText, siteTitle });

			// Save introduction text
			console.log("Saving intro text...");
			const introRes = await fetch("/api/settings", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ key: "introText", value: introText }),
			});

			if (!introRes.ok) {
				const errorText = await introRes.text();
				console.error("Failed to save intro text:", introRes.status, errorText);
				throw new Error(
					`Failed to save introduction text: ${introRes.status} - ${errorText}`,
				);
			}

			const introResult = await introRes.json();
			console.log("Intro text saved successfully:", introResult);

			// Save site title
			console.log("Saving site title...");
			const titleRes = await fetch("/api/settings", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ key: "siteTitle", value: siteTitle }),
			});

			if (!titleRes.ok) {
				const errorText = await titleRes.text();
				console.error("Failed to save site title:", titleRes.status, errorText);
				throw new Error(
					`Failed to save site title: ${titleRes.status} - ${errorText}`,
				);
			}

			const titleResult = await titleRes.json();
			console.log("Site title saved successfully:", titleResult);

			// Save hero image URL
			if (heroImage !== undefined) {
				console.log("Saving hero image...");
				const heroRes = await fetch("/api/settings", {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ key: "heroImage", value: heroImage }),
				});

				if (!heroRes.ok) {
					const errorText = await heroRes.text();
					console.error("Failed to save hero image:", heroRes.status, errorText);
					throw new Error(
						`Failed to save hero image: ${heroRes.status} - ${errorText}`,
					);
				}

				const heroResult = await heroRes.json();
				console.log("Hero image saved successfully:", heroResult);
			}

			// Save about enabled setting
			console.log("Saving about enabled setting...");
			const aboutRes = await fetch("/api/settings", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ key: "aboutEnabled", value: aboutEnabled.toString() }),
			});

			if (!aboutRes.ok) {
				const errorText = await aboutRes.text();
				console.error("Failed to save about enabled:", aboutRes.status, errorText);
				throw new Error(
					`Failed to save about enabled: ${aboutRes.status} - ${errorText}`,
				);
			}

			const aboutResult = await aboutRes.json();
			console.log("About enabled saved successfully:", aboutResult);

			console.log("All settings saved successfully, redirecting...");
			window.location.assign("/");
		} catch (e) {
			console.error("Save settings error:", e);
			// Show a more user-friendly message since the data is actually being saved
			if (
				e.message &&
				(e.message.includes("Failed to save") || e.message.includes("fetch"))
			) {
				alert(
					"Settings may have been saved with warnings. Please refresh the page to verify.",
				);
			} else {
				alert(`Failed to save settings: ${e.message}`);
			}
		} finally {
			setSaving(false);
		}
	};

	if (!isAuthenticated) {
		return (
			<>
				<Header
					siteTitle={siteTitle}
					isAuthenticated={false}
					onLogout={logout}
					onSettings={() => {}}
				/>
				<div className="app-container settings-page">
					<main
						style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}
					>
						<p>Access denied. Please log in to access settings.</p>
						<button onClick={() => window.location.assign("/admin")}>
							Go to Login
						</button>
					</main>
				</div>
			</>
		);
	}

	if (loading) {
		return (
			<>
				<Header
					siteTitle={siteTitle}
					isAuthenticated={isAuthenticated}
					onLogout={logout}
					onSettings={() => {}}
				/>
				<div className="app-container settings-page">
					<main
						style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}
					>
						<p>Loading settings...</p>
					</main>
				</div>
			</>
		);
	}

	return (
		<>
			<Header
				siteTitle={siteTitle}
				isAuthenticated={isAuthenticated}
				onLogout={logout}
				onSettings={() => {}}
			/>
			<div className="app-container settings-page">
				<main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
					<h1 style={{ fontWeight: 400, fontFamily: "Inter, sans-serif" }}>
						Settings
					</h1>

					<div style={{ marginBottom: "24px" }}>
						<label
							style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
						>
							Site title
						</label>
						<input
							type="text"
							value={siteTitle}
							onChange={(e) => setSiteTitle(e.target.value)}
							style={{
								width: "100%",
								fontFamily: "Inter, system-ui, sans-serif",
								fontSize: 14,
								padding: 10,
								boxSizing: "border-box",
								border: "1px solid #d1d5db",
								borderRadius: 6,
							}}
							placeholder="Enter your site title"
							disabled={saving}
						/>
					</div>

					<div style={{ marginBottom: "24px" }}>
						<label
							style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
						>
							Hero image
						</label>
						<input
							type="file"
							accept="image/*"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) {
									handleImageUpload(file);
								}
							}}
							style={{
								width: "100%",
								fontFamily: "Inter, system-ui, sans-serif",
								fontSize: 14,
								padding: 10,
								boxSizing: "border-box",
								border: "1px solid #d1d5db",
								borderRadius: 6,
							}}
							disabled={saving || uploading}
						/>
						{uploading && (
							<div style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
								Uploading...
							</div>
						)}
						{heroImage && (
							<div style={{ marginTop: 12 }}>
								<div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
									Current hero image:
								</div>
								<img
									src={heroImage}
									alt="Hero preview"
									style={{
										width: "150px",
										height: "auto",
										border: "1px solid #d1d5db",
										borderRadius: 6,
									}}
								/>
								<button
									onClick={() => setHeroImage("")}
									style={{
										display: "block",
										marginTop: 8,
										background: "transparent",
										border: "1px solid #dc2626",
										color: "#dc2626",
										padding: "4px 8px",
										borderRadius: 4,
										fontSize: 12,
										cursor: "pointer",
									}}
									disabled={saving}
								>
									Remove image
								</button>
							</div>
						)}
					</div>

					<div>
						<label
							style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
						>
							Introduction text
						</label>
						<textarea
							value={introText}
							onChange={(e) => setIntroText(e.target.value)}
							rows={6}
							style={{
								width: "100%",
								fontFamily: "Inter, system-ui, sans-serif",
								fontSize: 14,
								padding: 10,
								boxSizing: "border-box",
								border: "1px solid #d1d5db",
								borderRadius: 6,
							}}
							placeholder="Write a short introduction to show on the homepage"
							disabled={saving}
						/>
					</div>

					<div style={{ marginBottom: "24px" }}>
						<label
							style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
						>
							<input
								type="checkbox"
								checked={aboutEnabled}
								onChange={(e) => setAboutEnabled(e.target.checked)}
								disabled={saving}
								style={{ marginRight: "8px" }}
							/>
							Enable "About Me" page
						</label>
						<div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
							When enabled, an "About Me" link will appear in the header navigation
						</div>
					</div>

					<div style={{ marginTop: 20, display: "flex", gap: 8 }}>
						<button
							onClick={handleSave}
							disabled={saving}
							style={{
								background: "#fff",
								border: "1px solid #d1d5db",
								borderRadius: 8,
								padding: "8px 12px",
								cursor: saving ? "default" : "pointer",
								opacity: saving ? 0.6 : 1,
							}}
						>
							{saving ? "Saving..." : "Save"}
						</button>
						<button
							onClick={() => window.location.assign("/")}
							disabled={saving}
							style={{
								background: "transparent",
								border: "none",
								color: "#111",
								cursor: saving ? "default" : "pointer",
								opacity: saving ? 0.6 : 1,
							}}
						>
							Cancel
						</button>
					</div>
				</main>
			</div>
		</>
	);
}

function PostEditor({ id }: { id: string }) {
	const { isAuthenticated, token, logout } = useAuth();
	const [content, setContent] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [dirty, setDirty] = useState(false);
	const [creating, setCreating] = useState(false);
	const [siteTitle, setSiteTitle] = useState<string>("");
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
	}, [id]);

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
	}, [id]);

	useEffect(() => {
		// Load site title and post mentions
		const loadSettings = async () => {
			try {
				const res = await fetch("/api/settings");
				if (res.ok) {
					const data = await res.json();
					setSiteTitle(data.siteTitle || "");
				}
			} catch (e) {
				console.error("Failed to load settings:", e);
			}
		};

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


		loadSettings();
		loadPostMentions();
		loadBacklinks();
	}, [id, loadBacklinks]);

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
				siteTitle={siteTitle}
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

function AppContent() {
	const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
	const [setupLoading, setSetupLoading] = useState(true);

	const path = typeof window !== "undefined" ? window.location.pathname : "/";
	const match = useMemo(() => {
		const m = path.match(/^\/posts\/([A-Za-z0-9_-]+)$/);
		return m?.[1];
	}, [path]);

	useEffect(() => {
		// Check if setup is needed on app start
		const checkSetupStatus = async () => {
			try {
				const res = await fetch("/api/setup/status");
				if (res.ok) {
					const data = await res.json();
					setNeedsSetup(data.needsSetup);
				}
			} catch (e) {
				console.error("Failed to check setup status:", e);
				// Assume setup is not needed if we can't check
				setNeedsSetup(false);
			} finally {
				setSetupLoading(false);
			}
		};

		checkSetupStatus();
	}, []);

	// Show loading while checking setup status
	if (setupLoading) {
		return (
			<div className="login-container">
				<div className="login-content">
					<p>Loading...</p>
				</div>
			</div>
		);
	}

	// Show registration page if setup is needed
	if (needsSetup) {
		return <Registration />;
	}

	// Normal app routing
	if (path === "/admin") {
		return <Login />;
	}
	if (match) {
		return <PostEditor id={match} />;
	}
	if (path === "/archive") {
		return <Archive />;
	}
	if (path === "/about") {
		return <AboutMe />;
	}
	if (path === "/settings") {
		return <Settings />;
	}
	return <Home />;
}

function AboutMe() {
	const { isAuthenticated, token, logout } = useAuth();
	const [content, setContent] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [dirty, setDirty] = useState(false);
	const [siteTitle, setSiteTitle] = useState<string>("");
	const [aboutEnabled, setAboutEnabled] = useState<boolean>(false);
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
		// Load site settings and post mentions
		const loadSettings = async () => {
			try {
				const res = await fetch("/api/settings");
				if (res.ok) {
					const data = await res.json();
					setSiteTitle(data.siteTitle || "");
					setAboutEnabled(data.aboutEnabled === "true");
				}
			} catch (e) {
				console.error("Failed to load settings:", e);
			}
		};

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

		loadSettings();
		loadPostMentions();
	}, []);

	// If About Me is disabled, show 404-like page
	if (!loading && !aboutEnabled) {
		return (
			<div className="home-container">
				<Header
					siteTitle={siteTitle}
					isAuthenticated={isAuthenticated}
					onLogout={logout}
					onSettings={() => window.location.assign("/settings")}
					aboutEnabled={aboutEnabled}
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
				siteTitle={siteTitle}
				isAuthenticated={isAuthenticated}
				onLogout={logout}
				onSettings={() => window.location.assign("/settings")}
				aboutEnabled={aboutEnabled}
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

export default function App() {
	useEffect(() => {
		// Set default typography preset for textforge
		const preset =
			getPresetById("inter-plusjakarta") || getPresetById("figtree-epilogue");
		if (preset) {
			const root = document.documentElement;
			root.style.setProperty("--font-body", preset.body);
			root.style.setProperty("--font-heading", preset.heading);
		}
	}, []);

	return (
		<AuthProvider>
			<AppContent />
		</AuthProvider>
	);
}

function Archive() {
	const { isAuthenticated, logout, token } = useAuth();
	const [posts, setPosts] = useState<Note[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [siteTitle, setSiteTitle] = useState<string>("");
	const [heroImage, setHeroImage] = useState<string>("");
	const [aboutEnabled, setAboutEnabled] = useState<boolean>(false);
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		postId: number;
	} | null>(null);
	const [confirmDialog, setConfirmDialog] = useState<{
		postId: number;
		title: string;
	} | null>(null);

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
			console.error(e);
			alert("Failed to delete post");
		}
	};

	const handleRightClick = (e: React.MouseEvent, postId: number) => {
		if (!isAuthenticated) return;
		e.preventDefault();
		setContextMenu({ x: e.clientX, y: e.clientY, postId });
	};

	const handleDeleteClick = (postId: number, postTitle: string) => {
		setContextMenu(null);
		setConfirmDialog({ postId, title: postTitle });
	};

	const handleConfirmDelete = async () => {
		if (!confirmDialog) return;
		await handleDeletePost(confirmDialog.postId);
		setConfirmDialog(null);
	};

	// Fuzzy search function
	const fuzzySearch = useCallback((query: string, text: string): boolean => {
		if (!query) return true;
		
		const queryLower = query.toLowerCase();
		const textLower = text.toLowerCase();
		
		// Simple fuzzy matching: all query characters must appear in order
		let queryIndex = 0;
		for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
			if (textLower[i] === queryLower[queryIndex]) {
				queryIndex++;
			}
		}
		return queryIndex === queryLower.length;
	}, []);

	// Filter posts based on search query
	const filteredPosts = useMemo(() => {
		if (!searchQuery.trim()) return posts;
		
		return posts.filter(post => {
			const title = post.title || 'Untitled';
			return fuzzySearch(searchQuery, title);
		});
	}, [posts, searchQuery, fuzzySearch]);

	useEffect(() => {
		console.log("📋 Archive useEffect: Starting, token:", !!token);
		const load = async () => {
			try {
				console.log("📋 Archive: Fetching posts with auth:", !!token);
				const res = await fetch("/api/posts", {
					headers: token ? { Authorization: `Bearer ${token}` } : {}
				});
				if (res.ok) {
					const list: Note[] = await res.json();
					console.log("📋 Archive: Received", list.length, "posts. Private posts:", list.filter(p => p.isPrivate).length);
					const sorted = [...list].sort((a, b) => {
						const au = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
						const bu = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
						return bu - au;
					});
					setPosts(sorted);
				} else {
					console.log("📋 Archive: Failed to fetch posts:", res.status);
					setError("Failed to load posts");
				}
			} catch (e) {
				console.log("📋 Archive: Error fetching posts:", e);
				setError("Failed to load posts");
			} finally {
				setLoading(false);
			}
		};
		const loadTitle = async () => {
			try {
				const res = await fetch("/api/settings");
				if (res.ok) {
					const data = await res.json();
					setSiteTitle(data.siteTitle || "");
					setHeroImage(data.heroImage || "");
					setAboutEnabled(data.aboutEnabled === "true");
				}
			} catch {}
		};
		load();
		loadTitle();
	}, [token]);

	return (
		<div className="home-container">
			<Header
				siteTitle={siteTitle}
				isAuthenticated={isAuthenticated}
				onLogout={logout}
				onSettings={() => window.location.assign("/settings")}
				aboutEnabled={aboutEnabled}
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
													—{" "}
													{new Date(p.updatedAt).toLocaleDateString(undefined, {
														year: "numeric",
														month: "long",
														day: "numeric",
													})}
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
