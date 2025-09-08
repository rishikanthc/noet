import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getPresetById } from "textforge";
import { AuthProvider } from "./components/auth/AuthProvider";
import { AppContent } from "./components/AppContent";
import { queryClient } from "./lib/queryClient";
import "./styles.css";

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
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<AppContent />
			</AuthProvider>
		</QueryClientProvider>
	);
}