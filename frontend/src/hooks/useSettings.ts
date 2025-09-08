import { useState, useEffect } from 'react';

interface Settings {
	introText: string;
	siteTitle: string;
	heroImage: string;
	aboutEnabled: boolean;
}

export function useSettings() {
	const [settings, setSettings] = useState<Settings>({
		introText: "",
		siteTitle: "",
		heroImage: "",
		aboutEnabled: false,
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