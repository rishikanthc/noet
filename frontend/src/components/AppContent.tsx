import { useState, useEffect, useMemo } from "react";
import { Login } from "./auth/Login";
import { Registration } from "./auth/Registration";
import { Home } from "./pages/Home";
import { Archive } from "./pages/Archive";
import { AboutMe } from "./pages/AboutMe";
import { Settings } from "./pages/Settings";
import { PostEditor } from "./pages/PostEditor";
import { usePrefetch } from "../hooks/usePrefetch";
import { useAuth } from "../hooks/useAuth";

export function AppContent() {
	const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
	const [setupLoading, setSetupLoading] = useState(true);
	const { token } = useAuth();
	const { prefetchPosts, prefetchSettings } = usePrefetch(token);

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

	// Aggressively prefetch data for instant navigation
	useEffect(() => {
		if (!setupLoading && !needsSetup && token) {
			// Prefetch all common data immediately
			prefetchPosts();
			prefetchSettings();
		}
	}, [setupLoading, needsSetup, token, prefetchPosts, prefetchSettings]);

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

	// Normal app routing - no code splitting for instant navigation
	return (
		<>
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
		</>
	);
}