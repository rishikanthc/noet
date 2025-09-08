import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export function Login() {
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