import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export function useAIEdit() {
	const { token } = useAuth();
	const [isProcessing, setIsProcessing] = useState(false);

	const editText = useCallback(async (selectedText: string, userPrompt: string, model?: string): Promise<string> => {
		if (!token) {
			throw new Error('Authentication required');
		}

		setIsProcessing(true);
		try {
			const response = await fetch('/api/ai/edit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`,
				},
				body: JSON.stringify({
					selectedText,
					userPrompt,
					model,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(errorText || `Request failed with status ${response.status}`);
			}

			const data = await response.json();
			return data.editedText;
		} catch (error: any) {
			throw new Error(error.message || 'Failed to process text with AI');
		} finally {
			setIsProcessing(false);
		}
	}, [token]);

	return {
		editText,
		isProcessing,
	};
}