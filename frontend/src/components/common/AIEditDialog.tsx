import { useState, useEffect, memo } from 'react';

interface AIEditDialogProps {
	isOpen: boolean;
	selectedText: string;
	onClose: () => void;
	onApply: (editedText: string) => void;
	onEdit: (userPrompt: string) => Promise<string>;
}

export const AIEditDialog = memo<AIEditDialogProps>(function AIEditDialog({
	isOpen,
	selectedText,
	onClose,
	onApply,
	onEdit,
}) {
	const [userPrompt, setUserPrompt] = useState('');
	const [editedText, setEditedText] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const [showPreview, setShowPreview] = useState(false);

	useEffect(() => {
		if (isOpen) {
			// Reset state when dialog opens
			setUserPrompt('');
			setEditedText('');
			setError('');
			setShowPreview(false);
		}
	}, [isOpen]);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		
		if (isOpen) {
			document.addEventListener('keydown', handleEscape);
			return () => document.removeEventListener('keydown', handleEscape);
		}
	}, [isOpen, onClose]);

	const handleEdit = async () => {
		if (!userPrompt.trim()) return;
		
		setIsLoading(true);
		setError('');
		
		try {
			const result = await onEdit(userPrompt.trim());
			setEditedText(result);
			setShowPreview(true);
		} catch (err: any) {
			setError(err.message || 'Failed to process text');
		} finally {
			setIsLoading(false);
		}
	};

	const handleApply = () => {
		onApply(editedText);
		onClose();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			if (showPreview) {
				handleApply();
			} else {
				handleEdit();
			}
		}
	};

	if (!isOpen) return null;

	return (
		<div className="dialog-overlay" style={{ zIndex: 1001 }}>
			<div 
				className="dialog-content" 
				style={{ 
					maxWidth: '600px', 
					width: '90vw',
					maxHeight: '80vh',
					overflow: 'auto'
				}}
			>
				<div style={{ marginBottom: '16px' }}>
					<h3 style={{ 
						margin: 0, 
						fontSize: '18px', 
						fontWeight: 500, 
						color: '#111',
						fontFamily: 'Inter, system-ui, sans-serif'
					}}>
						AI Text Editing
					</h3>
				</div>

				{/* Original text preview */}
				<div style={{ marginBottom: '16px' }}>
					<label style={{ 
						display: 'block', 
						fontSize: '12px', 
						fontWeight: 500,
						color: '#666',
						marginBottom: '6px',
						textTransform: 'uppercase',
						letterSpacing: '0.5px'
					}}>
						Original Text
					</label>
					<div style={{
						background: '#f8f9fa',
						border: '1px solid #e5e7eb',
						borderRadius: '6px',
						padding: '12px',
						fontSize: '14px',
						lineHeight: '1.5',
						color: '#374151',
						maxHeight: '120px',
						overflow: 'auto'
					}}>
						{selectedText}
					</div>
				</div>

				{!showPreview ? (
					<>
						{/* Prompt input */}
						<div style={{ marginBottom: '16px' }}>
							<label style={{ 
								display: 'block', 
								fontSize: '12px', 
								fontWeight: 500,
								color: '#666',
								marginBottom: '6px',
								textTransform: 'uppercase',
								letterSpacing: '0.5px'
							}}>
								How would you like to improve this text?
							</label>
							<textarea
								value={userPrompt}
								onChange={(e) => setUserPrompt(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="E.g., 'Make it more concise', 'Fix grammar and clarity', 'Make it more professional'"
								rows={3}
								style={{
									width: '100%',
									fontFamily: 'Inter, system-ui, sans-serif',
									fontSize: '14px',
									padding: '12px',
									boxSizing: 'border-box',
									border: '1px solid #d1d5db',
									borderRadius: '6px',
									resize: 'vertical',
									minHeight: '80px'
								}}
								disabled={isLoading}
								autoFocus
							/>
						</div>

						{error && (
							<div style={{
								background: '#fee2e2',
								border: '1px solid #fecaca',
								borderRadius: '6px',
								padding: '12px',
								marginBottom: '16px',
								fontSize: '14px',
								color: '#dc2626'
							}}>
								{error}
							</div>
						)}

						{/* Action buttons */}
						<div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
							<button
								onClick={onClose}
								disabled={isLoading}
								style={{
									background: 'transparent',
									border: 'none',
									color: '#6b7280',
									cursor: 'pointer',
									padding: '8px 12px',
									borderRadius: '6px',
									fontSize: '14px',
									fontFamily: 'Inter, system-ui, sans-serif'
								}}
							>
								Cancel
							</button>
							<button
								onClick={handleEdit}
								disabled={isLoading || !userPrompt.trim()}
								style={{
									background: isLoading || !userPrompt.trim() ? '#9ca3af' : '#5046e6',
									color: 'white',
									border: 'none',
									cursor: isLoading || !userPrompt.trim() ? 'not-allowed' : 'pointer',
									padding: '8px 16px',
									borderRadius: '6px',
									fontSize: '14px',
									fontWeight: 500,
									fontFamily: 'Inter, system-ui, sans-serif',
									display: 'flex',
									alignItems: 'center',
									gap: '6px'
								}}
							>
								{isLoading && (
									<div style={{
										width: '12px',
										height: '12px',
										border: '2px solid rgba(255,255,255,0.3)',
										borderTop: '2px solid white',
										borderRadius: '50%',
										animation: 'spin 1s linear infinite'
									}} />
								)}
								{isLoading ? 'Processing...' : 'Generate (⌘↵)'}
							</button>
						</div>
					</>
				) : (
					<>
						{/* Edited text preview */}
						<div style={{ marginBottom: '16px' }}>
							<label style={{ 
								display: 'block', 
								fontSize: '12px', 
								fontWeight: 500,
								color: '#666',
								marginBottom: '6px',
								textTransform: 'uppercase',
								letterSpacing: '0.5px'
							}}>
								AI Suggestion
							</label>
							<div style={{
								background: '#f0fdf4',
								border: '1px solid #bbf7d0',
								borderRadius: '6px',
								padding: '12px',
								fontSize: '14px',
								lineHeight: '1.5',
								color: '#374151',
								maxHeight: '200px',
								overflow: 'auto',
								whiteSpace: 'pre-wrap'
							}}>
								{editedText}
							</div>
						</div>

						{/* Preview action buttons */}
						<div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
							<button
								onClick={() => setShowPreview(false)}
								style={{
									background: 'transparent',
									border: '1px solid #d1d5db',
									color: '#374151',
									cursor: 'pointer',
									padding: '8px 12px',
									borderRadius: '6px',
									fontSize: '14px',
									fontFamily: 'Inter, system-ui, sans-serif'
								}}
							>
								← Edit Prompt
							</button>
							<button
								onClick={onClose}
								style={{
									background: 'transparent',
									border: 'none',
									color: '#6b7280',
									cursor: 'pointer',
									padding: '8px 12px',
									borderRadius: '6px',
									fontSize: '14px',
									fontFamily: 'Inter, system-ui, sans-serif'
								}}
							>
								Cancel
							</button>
							<button
								onClick={handleApply}
								style={{
									background: '#059669',
									color: 'white',
									border: 'none',
									cursor: 'pointer',
									padding: '8px 16px',
									borderRadius: '6px',
									fontSize: '14px',
									fontWeight: 500,
									fontFamily: 'Inter, system-ui, sans-serif'
								}}
							>
								Apply Changes (⌘↵)
							</button>
						</div>
					</>
				)}
			</div>

			<style jsx>{`
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
			`}</style>
		</div>
	);
});