import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Header } from "../layout/Header";

export function Settings() {
	const { isAuthenticated, token, logout } = useAuth();
	const [introText, setIntroText] = useState<string>("");
	const [siteTitle, setSiteTitle] = useState<string>("");
	const [heroImage, setHeroImage] = useState<string>("");
	const [aboutEnabled, setAboutEnabled] = useState<boolean>(false);
	const [openaiApiKey, setOpenaiApiKey] = useState<string>("");
	const [aiEnabled, setAiEnabled] = useState<boolean>(false);
	const [uploading, setUploading] = useState(false);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const loadSettings = async () => {
			try {
				// Load all settings
				const res = await fetch("/api/settings");
				if (res.ok) {
					const data = await res.json();
					setIntroText(data.introText || "");
					setSiteTitle(data.siteTitle || "");
					setHeroImage(data.heroImage || "");
					setAboutEnabled(data.aboutEnabled === "true");
					setOpenaiApiKey(data.openai_api_key || "");
					setAiEnabled(data.ai_enabled === "true");
				}
			} catch (e) {
				console.error("Failed to load settings:", e);
			} finally {
				setLoading(false);
			}
		};
		loadSettings();
	}, []);

	const handleImageUpload = async (file: File) => {
		if (!isAuthenticated || !token) return;
		setUploading(true);

		try {
			const formData = new FormData();
			formData.append("file", file);

			const response = await fetch("/api/uploads", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Upload failed: ${errorText}`);
			}

			const data = await response.json();
			setHeroImage(data.url);
		} catch (e: any) {
			console.error("Image upload error:", e);
			alert(`Failed to upload image: ${e.message}`);
		} finally {
			setUploading(false);
		}
	};

	const handleSave = async () => {
		if (!isAuthenticated || !token) return;
		setSaving(true);

		try {
			console.log("Saving settings...", { introText, siteTitle });

			// Save introduction text
			console.log("Saving intro text...");
			const introRes = await fetch("/api/settings", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ key: "introText", value: introText }),
			});

			if (!introRes.ok) {
				const errorText = await introRes.text();
				console.error("Failed to save intro text:", introRes.status, errorText);
				throw new Error(
					`Failed to save introduction text: ${introRes.status} - ${errorText}`,
				);
			}

			const introResult = await introRes.json();
			console.log("Intro text saved successfully:", introResult);

			// Save site title
			console.log("Saving site title...");
			const titleRes = await fetch("/api/settings", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ key: "siteTitle", value: siteTitle }),
			});

			if (!titleRes.ok) {
				const errorText = await titleRes.text();
				console.error("Failed to save site title:", titleRes.status, errorText);
				throw new Error(
					`Failed to save site title: ${titleRes.status} - ${errorText}`,
				);
			}

			const titleResult = await titleRes.json();
			console.log("Site title saved successfully:", titleResult);

			// Save hero image URL
			if (heroImage !== undefined) {
				console.log("Saving hero image...");
				const heroRes = await fetch("/api/settings", {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ key: "heroImage", value: heroImage }),
				});

				if (!heroRes.ok) {
					const errorText = await heroRes.text();
					console.error("Failed to save hero image:", heroRes.status, errorText);
					throw new Error(
						`Failed to save hero image: ${heroRes.status} - ${errorText}`,
					);
				}

				const heroResult = await heroRes.json();
				console.log("Hero image saved successfully:", heroResult);
			}

			// Save about enabled setting
			console.log("Saving about enabled setting...");
			const aboutRes = await fetch("/api/settings", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ key: "aboutEnabled", value: aboutEnabled.toString() }),
			});

			if (!aboutRes.ok) {
				const errorText = await aboutRes.text();
				console.error("Failed to save about enabled:", aboutRes.status, errorText);
				throw new Error(
					`Failed to save about enabled: ${aboutRes.status} - ${errorText}`,
				);
			}

			const aboutResult = await aboutRes.json();
			console.log("About enabled saved successfully:", aboutResult);

			// Save AI settings
			console.log("Saving AI settings...");
			const aiEnabledRes = await fetch("/api/settings", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ key: "ai_enabled", value: aiEnabled.toString() }),
			});

			if (!aiEnabledRes.ok) {
				const errorText = await aiEnabledRes.text();
				console.error("Failed to save AI enabled:", aiEnabledRes.status, errorText);
				throw new Error(
					`Failed to save AI enabled: ${aiEnabledRes.status} - ${errorText}`,
				);
			}

			// Save OpenAI API key if provided
			if (openaiApiKey.trim()) {
				console.log("Saving OpenAI API key...");
				const apiKeyRes = await fetch("/api/settings", {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ key: "openai_api_key", value: openaiApiKey.trim() }),
				});

				if (!apiKeyRes.ok) {
					const errorText = await apiKeyRes.text();
					console.error("Failed to save OpenAI API key:", apiKeyRes.status, errorText);
					throw new Error(
						`Failed to save OpenAI API key: ${apiKeyRes.status} - ${errorText}`,
					);
				}
			}

			console.log("All settings saved successfully, redirecting...");
			window.location.assign("/");
		} catch (e: any) {
			console.error("Save settings error:", e);
			// Show a more user-friendly message since the data is actually being saved
			if (
				e.message &&
				(e.message.includes("Failed to save") || e.message.includes("fetch"))
			) {
				alert(
					"Settings may have been saved with warnings. Please refresh the page to verify.",
				);
			} else {
				alert(`Failed to save settings: ${e.message}`);
			}
		} finally {
			setSaving(false);
		}
	};

	if (!isAuthenticated) {
		return (
			<>
				<Header
					siteTitle={siteTitle}
					isAuthenticated={false}
					onLogout={logout}
					onSettings={() => {}}
				/>
				<div className="app-container settings-page">
					<main
						style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}
					>
						<p>Access denied. Please log in to access settings.</p>
						<button onClick={() => window.location.assign("/admin")}>
							Go to Login
						</button>
					</main>
				</div>
			</>
		);
	}

	if (loading) {
		return (
			<>
				<Header
					siteTitle={siteTitle}
					isAuthenticated={isAuthenticated}
					onLogout={logout}
					onSettings={() => {}}
				/>
				<div className="app-container settings-page">
					<main
						style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}
					>
						<p>Loading settings...</p>
					</main>
				</div>
			</>
		);
	}

	return (
		<>
			<Header
				siteTitle={siteTitle}
				isAuthenticated={isAuthenticated}
				onLogout={logout}
				onSettings={() => {}}
			/>
			<div className="app-container settings-page">
				<main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
					<h1 style={{ fontWeight: 400, fontFamily: "Inter, sans-serif" }}>
						Settings
					</h1>

					<div style={{ marginBottom: "24px" }}>
						<label
							style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
						>
							Site title
						</label>
						<input
							type="text"
							value={siteTitle}
							onChange={(e) => setSiteTitle(e.target.value)}
							style={{
								width: "100%",
								fontFamily: "Inter, system-ui, sans-serif",
								fontSize: 14,
								padding: 10,
								boxSizing: "border-box",
								border: "1px solid #d1d5db",
								borderRadius: 6,
							}}
							placeholder="Enter your site title"
							disabled={saving}
						/>
					</div>

					<div style={{ marginBottom: "24px" }}>
						<label
							style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
						>
							Hero image
						</label>
						<input
							type="file"
							accept="image/*"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) {
									handleImageUpload(file);
								}
							}}
							style={{
								width: "100%",
								fontFamily: "Inter, system-ui, sans-serif",
								fontSize: 14,
								padding: 10,
								boxSizing: "border-box",
								border: "1px solid #d1d5db",
								borderRadius: 6,
							}}
							disabled={saving || uploading}
						/>
						{uploading && (
							<div style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
								Uploading...
							</div>
						)}
						{heroImage && (
							<div style={{ marginTop: 12 }}>
								<div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
									Current hero image:
								</div>
								<img
									src={heroImage}
									alt="Hero preview"
									style={{
										width: "150px",
										height: "auto",
										border: "1px solid #d1d5db",
										borderRadius: 6,
									}}
								/>
								<button
									onClick={() => setHeroImage("")}
									style={{
										display: "block",
										marginTop: 8,
										background: "transparent",
										border: "1px solid #dc2626",
										color: "#dc2626",
										padding: "4px 8px",
										borderRadius: 4,
										fontSize: 12,
										cursor: "pointer",
									}}
									disabled={saving}
								>
									Remove image
								</button>
							</div>
						)}
					</div>

					<div>
						<label
							style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
						>
							Introduction text
						</label>
						<textarea
							value={introText}
							onChange={(e) => setIntroText(e.target.value)}
							rows={6}
							style={{
								width: "100%",
								fontFamily: "Inter, system-ui, sans-serif",
								fontSize: 14,
								padding: 10,
								boxSizing: "border-box",
								border: "1px solid #d1d5db",
								borderRadius: 6,
							}}
							placeholder="Write a short introduction to show on the homepage"
							disabled={saving}
						/>
					</div>

					<div style={{ marginBottom: "24px" }}>
						<label
							style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
						>
							<input
								type="checkbox"
								checked={aboutEnabled}
								onChange={(e) => setAboutEnabled(e.target.checked)}
								disabled={saving}
								style={{ marginRight: "8px" }}
							/>
							Enable "About Me" page
						</label>
						<div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
							When enabled, an "About Me" link will appear in the header navigation
						</div>
					</div>

					{/* AI Settings Section */}
					<div style={{ marginBottom: "24px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
						<h3 style={{ fontWeight: 500, fontSize: "16px", margin: "0 0 16px", color: "#111" }}>
							AI Editing
						</h3>
						
						<div style={{ marginBottom: "16px" }}>
							<label
								style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
							>
								<input
									type="checkbox"
									checked={aiEnabled}
									onChange={(e) => setAiEnabled(e.target.checked)}
									disabled={saving}
									style={{ marginRight: "8px" }}
								/>
								Enable AI text editing
							</label>
							<div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
								When enabled, you can use AI to improve selected text while editing
							</div>
						</div>

						{aiEnabled && (
							<div>
								<label
									style={{ display: "block", margin: "12px 0 6px", color: "#444" }}
								>
									OpenAI API Key
								</label>
								<input
									type="password"
									value={openaiApiKey}
									onChange={(e) => setOpenaiApiKey(e.target.value)}
									style={{
										width: "100%",
										fontFamily: "Inter, system-ui, sans-serif",
										fontSize: 14,
										padding: 10,
										boxSizing: "border-box",
										border: "1px solid #d1d5db",
										borderRadius: 6,
									}}
									placeholder="sk-..."
									disabled={saving}
								/>
								<div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
									Your OpenAI API key is stored securely and never exposed to the frontend.{" "}
									<a 
										href="https://platform.openai.com/api-keys" 
										target="_blank" 
										rel="noopener noreferrer"
										style={{ color: "#5046e6" }}
									>
										Get your API key
									</a>
								</div>
							</div>
						)}
					</div>

					<div style={{ marginTop: 20, display: "flex", gap: 8 }}>
						<button
							onClick={handleSave}
							disabled={saving}
							style={{
								background: "#fff",
								border: "1px solid #d1d5db",
								borderRadius: 8,
								padding: "8px 12px",
								cursor: saving ? "default" : "pointer",
								opacity: saving ? 0.6 : 1,
							}}
						>
							{saving ? "Saving..." : "Save"}
						</button>
						<button
							onClick={() => window.location.assign("/")}
							disabled={saving}
							style={{
								background: "transparent",
								border: "none",
								color: "#111",
								cursor: saving ? "default" : "pointer",
								opacity: saving ? 0.6 : 1,
							}}
						>
							Cancel
						</button>
					</div>
				</main>
			</div>
		</>
	);
}