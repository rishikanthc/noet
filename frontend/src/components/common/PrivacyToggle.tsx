import { memo } from 'react';

interface PrivacyToggleProps {
	postId: number;
	isPrivate: boolean;
	onToggle: (postId: number) => void;
	isToggling?: boolean;
}

export const PrivacyToggle = memo<PrivacyToggleProps>(function PrivacyToggle({ 
	postId, 
	isPrivate, 
	onToggle, 
	isToggling = false 
}) {
	return (
		<button
			onClick={() => onToggle(postId)}
			disabled={isToggling}
			title={isPrivate ? "Post is private - click to publish" : "Post is published - click to make private"}
			style={{
				background: 'transparent',
				border: 'none',
				color: isPrivate ? '#888888' : '#5046e6',
				fontSize: '12px',
				fontWeight: '400',
				cursor: isToggling ? 'default' : 'pointer',
				padding: '2px 0',
				fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial',
				opacity: isToggling ? 0.6 : 1,
				transition: 'color 0.1s ease, opacity 0.1s ease',
				width: '65px',
				textAlign: 'left' as const,
				flexShrink: 0,
			}}
			onMouseEnter={(e) => {
				if (!isToggling) {
					e.currentTarget.style.color = isPrivate ? '#666666' : '#4038c9';
				}
			}}
			onMouseLeave={(e) => {
				if (!isToggling) {
					e.currentTarget.style.color = isPrivate ? '#888888' : '#5046e6';
				}
			}}
		>
			{isToggling ? (
				"Publishing..."
			) : isPrivate ? (
				"Private"
			) : (
				"Published"
			)}
		</button>
	);
});