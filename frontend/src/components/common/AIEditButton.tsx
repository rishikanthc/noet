import { memo } from 'react';

interface AIEditButtonProps {
	x: number;
	y: number;
	onEdit: () => void;
	visible: boolean;
}

export const AIEditButton = memo<AIEditButtonProps>(function AIEditButton({
	x,
	y,
	onEdit,
	visible,
}) {
	if (!visible) return null;

	return (
		<button
			onClick={onEdit}
			onMouseDown={(e) => e.preventDefault()} // Prevent text selection loss
			style={{
				position: 'absolute',
				left: x,
				top: y - 40, // Position above selection
				background: '#5046e6',
				color: 'white',
				border: 'none',
				borderRadius: '6px',
				padding: '6px 12px',
				fontSize: '12px',
				fontWeight: 500,
				cursor: 'pointer',
				zIndex: 1000,
				boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
				display: 'flex',
				alignItems: 'center',
				gap: '4px',
				fontFamily: 'Inter, system-ui, sans-serif',
				transition: 'all 0.1s ease',
				transform: 'translateX(-50%)', // Center on selection
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.background = '#4038c9';
				e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)';
				e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = '#5046e6';
				e.currentTarget.style.transform = 'translateX(-50%)';
				e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
			}}
		>
			<span style={{ fontSize: '14px' }}>✨</span>
			Improve
		</button>
	);
});