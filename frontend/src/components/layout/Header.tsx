import { memo } from 'react';

interface HeaderProps {
	siteTitle: string;
	isAuthenticated: boolean;
	onLogout: () => void;
	onSettings: () => void;
	onNewPost?: () => void;
	creating?: boolean;
	aboutEnabled?: boolean;
}

export const Header = memo<HeaderProps>(function Header({
	siteTitle,
	isAuthenticated,
	onLogout,
	onSettings,
	onNewPost,
	creating,
	aboutEnabled,
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
});