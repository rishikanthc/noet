import { useEffect, memo } from "react";

interface ConfirmDialogProps {
	message: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmDialog = memo<ConfirmDialogProps>(function ConfirmDialog({
	message,
	onConfirm,
	onCancel,
}) {
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [onCancel]);

	return (
		<div className="dialog-overlay">
			<div className="dialog-content">
				<p className="dialog-message">{message}</p>
				<div className="dialog-actions">
					<button className="dialog-button confirm-button" onClick={onConfirm}>
						Delete
					</button>
					<button className="dialog-button cancel-button" onClick={onCancel}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
});