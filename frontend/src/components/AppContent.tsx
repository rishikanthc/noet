import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Login } from "./auth/Login";
import { Registration } from "./auth/Registration";
import { Home } from "./pages/Home";
import { Archive } from "./pages/Archive";
import { AboutMe } from "./pages/AboutMe";
import { Settings } from "./pages/Settings";
import { PostEditor } from "./pages/PostEditor";
import { usePrefetch } from "../hooks/usePrefetch";
import { useAuth } from "../hooks/useAuth";
import { useRouter } from "../hooks/useRouter";
import { useSettings } from "../hooks/useSettings";
import { postsQueryKeys } from "../hooks/usePostsQuery";

export function AppContent() {
	const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
	const [setupLoading, setSetupLoading] = useState(true);
	const { token } = useAuth();
	const { prefetchPosts, prefetchSettings } = usePrefetch(token);
	const { path } = useRouter();
	const queryClient = useQueryClient();
	const { settings } = useSettings();

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

	useEffect(() => {
		const siteTitle = settings.siteTitle?.trim() || "Noet";
		let title = siteTitle;

		if (path === "/archive") {
			title = `Archive — ${siteTitle}`;
		} else if (path === "/about") {
			title = `About — ${siteTitle}`;
		} else if (path === "/settings") {
			title = `Settings — ${siteTitle}`;
		} else if (match) {
			const detailKey = postsQueryKeys.detail(match);
			const post =
				queryClient.getQueryData(detailKey) as { title?: string; id?: number } | undefined;
			const listPost =
				(queryClient.getQueryData(postsQueryKeys.list(true)) as { id: number; title?: string }[] | undefined)?.find(
					(p) => String(p.id) === match,
				);
			const resolvedTitle = post?.title || listPost?.title;
			if (resolvedTitle && resolvedTitle.trim()) {
				title = `${resolvedTitle.trim()} — ${siteTitle}`;
			} else {
				title = `Untitled — ${siteTitle}`;
			}
		}

		document.title = title;
	}, [path, match, queryClient, settings.siteTitle]);

	// Set up a listener to update title when post data changes in cache
	useEffect(() => {
		if (!match) return;

		const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
			if (
				event?.type === 'updated' &&
				event.query.queryKey[0] === 'posts' &&
				event.query.queryKey[1] === 'detail' &&
				event.query.queryKey[2] === match
			) {
				// Trigger title update by getting the latest data
				const post = queryClient.getQueryData(postsQueryKeys.detail(match)) as { title?: string } | undefined;
				const siteTitle = settings.siteTitle?.trim() || "Noet";
				if (post?.title && post.title.trim()) {
					document.title = `${post.title.trim()} — ${siteTitle}`;
				}
			}
		});

		return () => unsubscribe();
	}, [match, queryClient, settings.siteTitle]);

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
