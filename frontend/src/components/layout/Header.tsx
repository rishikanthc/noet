import { memo, useState, useEffect, useRef } from 'react';
import { TbGridDots } from 'react-icons/tb';
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
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	// Close menu when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				isMenuOpen &&
				menuRef.current &&
				buttonRef.current &&
				!menuRef.current.contains(event.target as Node) &&
				!buttonRef.current.contains(event.target as Node)
			) {
				setIsMenuOpen(false);
			}
		}

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isMenuOpen]);

	// Close menu on navigation
	const handleLinkClick = () => {
		setIsMenuOpen(false);
	};

	const handleMenuAction = (action: () => void) => {
		action();
		setIsMenuOpen(false);
	};

	return (
		<header className="site-header">
			<div className="site-header-content">
				<Link href="/" className={`site-title ${!siteTitle ? "empty" : ""}`}>
					{siteTitle || "Untitled Site"}
				</Link>

				{/* Desktop Navigation */}
				<div className="header-actions desktop-nav" role="navigation" aria-label="Primary">
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

				{/* Mobile Menu Button */}
				<div className="mobile-nav">
					<button
						ref={buttonRef}
						className="mobile-menu-button"
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						aria-label="Open navigation menu"
						aria-expanded={isMenuOpen}
					>
						<TbGridDots size={20} />
					</button>

					{/* Mobile Dropdown Menu */}
					{isMenuOpen && (
						<>
							<div className="mobile-menu-backdrop" onClick={() => setIsMenuOpen(false)} />
							<div ref={menuRef} className="mobile-menu-dropdown" role="navigation" aria-label="Mobile navigation">
								<Link
									className={`mobile-menu-item ${path === "/" ? "active" : ""}`}
									href="/"
									onClick={handleLinkClick}
								>
									Home
								</Link>
								<Link
									className={`mobile-menu-item ${path === "/archive" ? "active" : ""}`}
									href="/archive"
									onClick={handleLinkClick}
								>
									Archive
								</Link>
								{aboutEnabled && (
									<Link
										className={`mobile-menu-item ${path === "/about" ? "active" : ""}`}
										href="/about"
										onClick={handleLinkClick}
									>
										About Me
									</Link>
								)}
								<a className="mobile-menu-item" href="/rss.xml" onClick={handleLinkClick}>
									RSS
								</a>
								{isAuthenticated && (
									<>
										<div className="mobile-menu-separator" />
										<button
											className="mobile-menu-item mobile-menu-button"
											onClick={() => handleMenuAction(onSettings)}
										>
											Settings
										</button>
										{onNewPost && (
											<button
												className="mobile-menu-item mobile-menu-button"
												onClick={() => handleMenuAction(onNewPost)}
												disabled={creating}
											>
												{creating ? "Creating..." : "New Post"}
											</button>
										)}
										<button
											className="mobile-menu-item mobile-menu-button"
											onClick={() => handleMenuAction(onLogout)}
										>
											Logout
										</button>
									</>
								)}
							</div>
						</>
					)}
				</div>
			</div>
		</header>
	);
});