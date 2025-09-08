import { useState, useEffect } from 'react';

interface Settings {
	introText: string;
	siteTitle: string;
	heroImage: string;
	aboutEnabled: boolean;
	ai_enabled: boolean;
	openai_api_key: string;
}

export function useSettings() {
	const [settings, setSettings] = useState<Settings>({
		introText: "",
		siteTitle: "",
		heroImage: "",
		aboutEnabled: false,
		ai_enabled: false,
		openai_api_key: "",
	});

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const res = await fetch("/api/settings");
				if (res.ok) {
					const data = await res.json();
					setSettings({
						introText: data.introText || "",
						siteTitle: data.siteTitle || "",
						heroImage: data.heroImage || "",
						aboutEnabled: data.aboutEnabled === "true",
						ai_enabled: data.ai_enabled === "true",
						openai_api_key: data.openai_api_key || "",
					});
				}
			} catch (e) {
				console.error("Failed to load settings:", e);
			}
		};
		loadSettings();
	}, []);

	const updateSetting = (key: keyof Settings, value: string | boolean) => {
		setSettings(prev => ({ ...prev, [key]: value }));
	};

	return {
		settings,
		updateSetting,
	};
}