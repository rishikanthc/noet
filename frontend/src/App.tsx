import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./components/auth/AuthProvider";
import { AppContent } from "./components/AppContent";
import { queryClient } from "./lib/queryClient";
import "./styles.css";

export default function App() {

	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<AppContent />
			</AuthProvider>
		</QueryClientProvider>
	);
}