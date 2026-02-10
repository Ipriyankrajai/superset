import { init } from "ghostty-web";

let ready = false;
let initPromise: Promise<void> | null = null;

/**
 * Ensures the ghostty-web WASM module is loaded and ready.
 * Safe to call multiple times - will only initialize once.
 * Call eagerly at app startup and as a guard before terminal creation.
 */
export async function ensureGhosttyReady(): Promise<void> {
	if (ready) return;
	if (!initPromise) {
		initPromise = init().then(() => {
			ready = true;
		});
	}
	return initPromise;
}
