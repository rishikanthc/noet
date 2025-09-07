export function PrivacyToggle({ 
	postId, 
	isPrivate, 
	onToggle, 
	isToggling = false 
}: {
	postId: number;
	isPrivate: boolean;
	onToggle: (postId: number) => void;
	isToggling?: boolean;
}) {
	return (
		<button
			className="privacy-toggle"
			onClick={() => onToggle(postId)}
			disabled={isToggling}
			title={isPrivate ? "Post is private - click to publish" : "Post is published - click to make private"}
		>
			{isToggling ? (
				"..."
			) : isPrivate ? (
				<>🔒 Private</>
			) : (
				<>🌐 Published</>
			)}
		</button>
	);
}