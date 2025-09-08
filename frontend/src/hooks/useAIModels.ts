import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface AIModel {
	id: string;
	object: string;
	created: number;
	owned_by: string;
}

export function useAIModels() {
	const { token } = useAuth();
	const [models, setModels] = useState<AIModel[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchModels = async () => {
		if (!token) {
			setError('Authentication required');
			return;
		}

		setIsLoading(true);
		setError(null);
		
		try {
			const response = await fetch('/api/ai/models', {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(errorText || `Request failed with status ${response.status}`);
			}

			const data = await response.json();
			setModels(data.models || []);
		} catch (err: any) {
			setError(err.message || 'Failed to fetch AI models');
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (token) {
			fetchModels();
		}
	}, [token]);

	return {
		models,
		isLoading,
		error,
		refetch: fetchModels,
	};
}