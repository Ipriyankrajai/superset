const streamMountTokenByPane = new Map<string, string>();

export function registerTerminalStreamMount({
	paneId,
	token,
}: {
	paneId: string;
	token: string;
}): void {
	streamMountTokenByPane.set(paneId, token);
}

export function unregisterTerminalStreamMount({
	paneId,
	token,
}: {
	paneId: string;
	token: string;
}): void {
	if (streamMountTokenByPane.get(paneId) !== token) return;
	streamMountTokenByPane.delete(paneId);
}

export function isTerminalStreamMountCurrent({
	paneId,
	token,
}: {
	paneId: string;
	token: string;
}): boolean {
	return streamMountTokenByPane.get(paneId) === token;
}

export function resetTerminalStreamMountRegistryForTests(): void {
	streamMountTokenByPane.clear();
}
