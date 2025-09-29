import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface Settings {
	introText: string;
	siteTitle: string;
	heroImage: string;
	aboutEnabled: boolean;
	ai_enabled: boolean;
	openai_api_key: string;
}

const DEFAULT_SETTINGS: Settings = {
	introText: "",
	siteTitle: "",
	heroImage: "",
	aboutEnabled: false,
	ai_enabled: false,
	openai_api_key: "",
};

export async function fetchSettings(): Promise<Settings> {
	const res = await fetch("/api/settings", { cache: 'no-cache' });
	if (!res.ok) {
		throw new Error(`Failed to load settings: ${res.status}`);
	}

	const data = await res.json();
	return {
		introText: data.introText || "",
		siteTitle: data.siteTitle || "",
		heroImage: data.heroImage || "",
		aboutEnabled: data.aboutEnabled === "true",
		ai_enabled: data.ai_enabled === "true",
		openai_api_key: data.openai_api_key || "",
	};
}

export function useSettings() {
	const queryClient = useQueryClient();
	const { data, isLoading, error } = useQuery({
		queryKey: ['settings'],
		queryFn: fetchSettings,
		staleTime: 5 * 60 * 1000,
	});

	const updateSetting = useCallback((key: keyof Settings, value: string | boolean) => {
		queryClient.setQueryData<Settings | undefined>(['settings'], (prev) => ({
			...DEFAULT_SETTINGS,
			...(prev ?? {}),
			[key]: value,
		}));
	}, [queryClient]);

	return {
		settings: data ?? DEFAULT_SETTINGS,
		isLoading,
		error,
		updateSetting,
	};
}
