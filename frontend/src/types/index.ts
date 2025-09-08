export type Note = {
	id: number;
	title?: string;
	content?: string;
	createdAt?: string;
	updatedAt?: string;
	isPrivate: boolean;
};

export type User = {
	id: number;
	username: string;
};

export type AuthContextType = {
	user: User | null;
	token: string | null;
	login: (username: string, password: string) => Promise<boolean>;
	register: (username: string, password: string) => Promise<boolean>;
	logout: () => void;
	isAuthenticated: boolean;
	refreshToken: () => Promise<boolean>;
};

export type ContextMenuState = {
	x: number;
	y: number;
	postId: number;
} | null;

export type ConfirmDialogState = {
	postId: number;
	title: string;
} | null;