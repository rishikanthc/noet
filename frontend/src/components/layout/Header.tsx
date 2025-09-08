import { memo } from 'react';
import { Link } from "../common/Link";
import { useRouter } from "../../hooks/useRouter";

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
	const { path } = useRouter();
	
	return (
		<header className="site-header">
			<div className="site-header-content">
				<Link href="/" className={`site-title ${!siteTitle ? "empty" : ""}`}>
					{siteTitle || "Untitled Site"}
				</Link>
				<div className="header-actions" role="navigation" aria-label="Primary">
					<Link
						className={`header-button ${path === "/" ? "active" : ""}`}
						href="/"
					>
						Home
					</Link>
					<Link
						className={`header-button ${path === "/archive" ? "active" : ""}`}
						href="/archive"
					>
						Archive
					</Link>
					{aboutEnabled && (
						<Link
							className={`header-button ${path === "/about" ? "active" : ""}`}
							href="/about"
						>
							About Me
						</Link>
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