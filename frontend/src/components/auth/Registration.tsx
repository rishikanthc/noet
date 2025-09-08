import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export function Registration() {
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