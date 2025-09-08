import { useEffect, memo } from "react";

interface ContextMenuProps {
	x: number;
	y: number;
	onDelete: () => void;
	onClose: () => void;
}

export const ContextMenu = memo<ContextMenuProps>(function ContextMenu({
	x,
	y,
	onDelete,
	onClose,
}) {
	useEffect(() => {
		const handleClickOutside = () => onClose();
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("click", handleClickOutside);
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("click", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [onClose]);

	return (
		<div
			className="context-menu"
			style={{ left: x, top: y }}
			onMouseDown={(e) => e.stopPropagation()}
		>
			<button
				className="context-menu-item delete-item"
				onClick={(e) => {
					e.stopPropagation();
					onDelete();
				}}
			>
				Delete
			</button>
		</div>
	);
});