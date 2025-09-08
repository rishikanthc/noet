import { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { Login } from "./auth/Login";
import { Registration } from "./auth/Registration";
import { LoadingSpinner } from "./common/LoadingSpinner";

// Lazy load page components for code splitting
const Home = lazy(() => import("./pages/Home").then(module => ({ default: module.Home })));
const Archive = lazy(() => import("./pages/Archive").then(module => ({ default: module.Archive })));
const AboutMe = lazy(() => import("./pages/AboutMe").then(module => ({ default: module.AboutMe })));
const Settings = lazy(() => import("./pages/Settings").then(module => ({ default: module.Settings })));
const PostEditor = lazy(() => import("./pages/PostEditor").then(module => ({ default: module.PostEditor })));

export function AppContent() {
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
				console.error("AppContent: Failed to check setup status", e);
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

	// Normal app routing with Suspense for code splitting
	return (
		<Suspense fallback={<LoadingSpinner />}>
			{path === "/admin" ? (
				<Login />
			) : match ? (
				<PostEditor id={match} />
			) : path === "/archive" ? (
				<Archive />
			) : path === "/about" ? (
				<AboutMe />
			) : path === "/settings" ? (
				<Settings />
			) : (
				<Home />
			)}
		</Suspense>
	);
}