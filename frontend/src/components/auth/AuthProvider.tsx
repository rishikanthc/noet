import { createContext, useEffect, useState } from "react";
import { type AuthContextType, type User } from '../../types';

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);

	useEffect(() => {
		// Check for existing tokens in localStorage
		const savedToken = localStorage.getItem("auth_token");
		const savedRefreshToken = localStorage.getItem("refresh_token");
		
		if (savedToken) {
			// Validate token
			fetch("/api/auth/validate", {
				headers: { Authorization: `Bearer ${savedToken}` },
			})
				.then((res) => res.json())
				.then((data) => {
					if (data.valid) {
						setToken(savedToken);
						setUser(data.user);
						if (savedRefreshToken) {
							setRefreshTokenValue(savedRefreshToken);
						}
					} else {
						// Token expired, try refresh if we have refresh token
						if (savedRefreshToken) {
							attemptRefresh(savedRefreshToken);
						} else {
							// No refresh token, clear everything
							localStorage.removeItem("auth_token");
							localStorage.removeItem("refresh_token");
						}
					}
				})
				.catch((error) => {
					console.error("AuthProvider: Token validation request failed", error);
					// Error validating, try refresh if we have refresh token
					if (savedRefreshToken) {
						attemptRefresh(savedRefreshToken);
					} else {
						localStorage.removeItem("auth_token");
						localStorage.removeItem("refresh_token");
					}
				});
		}
	}, []);

	const attemptRefresh = async (refreshToken: string) => {
		try {
			const res = await fetch("/api/auth/refresh", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken }),
			});

			if (res.ok) {
				const data = await res.json();
				setToken(data.token);
				setUser(data.user);
				setRefreshTokenValue(data.refreshToken);
				localStorage.setItem("auth_token", data.token);
				localStorage.setItem("refresh_token", data.refreshToken);
			} else {
				console.error("AuthProvider: Token refresh failed - invalid response", { status: res.status });
				// Refresh failed, clear everything
				localStorage.removeItem("auth_token");
				localStorage.removeItem("refresh_token");
			}
		} catch (error) {
			console.error("AuthProvider: Token refresh request failed", error);
			localStorage.removeItem("auth_token");
			localStorage.removeItem("refresh_token");
		}
	};

	const login = async (
		username: string,
		password: string,
	): Promise<boolean> => {
		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});

			if (res.ok) {
				const data = await res.json();
				setToken(data.token);
				setUser(data.user);
				setRefreshTokenValue(data.refreshToken);
				localStorage.setItem("auth_token", data.token);
				localStorage.setItem("refresh_token", data.refreshToken);
				return true;
			} else {
				console.error("AuthProvider: Login failed - invalid credentials", { status: res.status, username });
			}
			return false;
		} catch (error) {
			console.error("AuthProvider: Login request failed", error);
			return false;
		}
	};

	const logout = () => {
		setToken(null);
		setUser(null);
		setRefreshTokenValue(null);
		localStorage.removeItem("auth_token");
		localStorage.removeItem("refresh_token");
	};

	const register = async (
		username: string,
		password: string,
	): Promise<boolean> => {
		try {
			const res = await fetch("/api/setup/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});

			if (res.ok) {
				const data = await res.json();
				setToken(data.token);
				setUser(data.user);
				setRefreshTokenValue(data.refreshToken);
				localStorage.setItem("auth_token", data.token);
				localStorage.setItem("refresh_token", data.refreshToken);
				return true;
			} else {
				console.error("AuthProvider: Registration failed", { status: res.status, username });
			}
			return false;
		} catch (error) {
			console.error("AuthProvider: Registration request failed", error);
			return false;
		}
	};

	const refreshToken = async (): Promise<boolean> => {
		if (!refreshTokenValue) return false;
		
		try {
			const res = await fetch("/api/auth/refresh", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken: refreshTokenValue }),
			});

			if (res.ok) {
				const data = await res.json();
				setToken(data.token);
				setUser(data.user);
				setRefreshTokenValue(data.refreshToken);
				localStorage.setItem("auth_token", data.token);
				localStorage.setItem("refresh_token", data.refreshToken);
				return true;
			} else {
				console.error("AuthProvider: Manual token refresh failed", { status: res.status });
			}
			return false;
		} catch (error) {
			console.error("AuthProvider: Manual token refresh request failed", error);
			return false;
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				login,
				register,
				logout,
				isAuthenticated: !!token && !!user,
				refreshToken,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}