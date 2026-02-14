import { toast } from "@superset/ui/sonner";
import type { Terminal as XTerm } from "ghostty-web";
import { useCallback, useEffect, useId, useRef } from "react";
import { useTabsStore } from "renderer/stores/tabs/store";
import {
	DEBUG_TERMINAL,
	STREAM_FLUSH_INTERVAL_MS,
	STREAM_MAX_BATCH_CHARS,
} from "../config";
import {
	isTerminalStreamMountCurrent,
	registerTerminalStreamMount,
	unregisterTerminalStreamMount,
} from "../stream-mount-registry";
import type { TerminalExitReason, TerminalStreamEvent } from "../types";

export interface UseTerminalStreamOptions {
	paneId: string;
	xtermRef: React.MutableRefObject<XTerm | null>;
	isStreamReadyRef: React.MutableRefObject<boolean>;
	isExitedRef: React.MutableRefObject<boolean>;
	wasKilledByUserRef: React.MutableRefObject<boolean>;
	pendingEventsRef: React.MutableRefObject<TerminalStreamEvent[]>;
	setExitStatus: (status: "killed" | "exited" | null) => void;
	setConnectionError: (error: string | null) => void;
	updateModesFromData: (data: string) => void;
	updateCwdFromData: (data: string) => void;
}

export interface UseTerminalStreamReturn {
	handleTerminalExit: (
		exitCode: number,
		xterm: XTerm,
		reason?: TerminalExitReason,
	) => void;
	handleStreamError: (
		event: Extract<TerminalStreamEvent, { type: "error" }>,
		xterm: XTerm,
	) => void;
	handleStreamData: (event: TerminalStreamEvent) => void;
}

/**
 * Hook to handle terminal stream events (data, exit, disconnect, error).
 */
export function useTerminalStream({
	paneId,
	xtermRef,
	isStreamReadyRef,
	isExitedRef,
	wasKilledByUserRef,
	pendingEventsRef,
	setExitStatus,
	setConnectionError,
	updateModesFromData,
	updateCwdFromData,
}: UseTerminalStreamOptions): UseTerminalStreamReturn {
	const setPaneStatus = useTabsStore((s) => s.setPaneStatus);
	const streamMountToken = useId();
	const dataBatchRef = useRef<string[]>([]);
	const dataBatchCharsRef = useRef(0);
	const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const flushCountRef = useRef(0);
	const maxBatchCharsRef = useRef(0);

	useEffect(() => {
		registerTerminalStreamMount({
			paneId,
			token: streamMountToken,
		});
		if (DEBUG_TERMINAL) {
			console.log(`[Terminal] Registered stream mount: ${paneId}`);
		}
		return () => {
			unregisterTerminalStreamMount({
				paneId,
				token: streamMountToken,
			});
			if (DEBUG_TERMINAL) {
				console.log(`[Terminal] Unregistered stream mount: ${paneId}`);
			}
		};
	}, [paneId, streamMountToken]);

	const flushDataBatch = useCallback(() => {
		if (flushTimeoutRef.current) {
			clearTimeout(flushTimeoutRef.current);
			flushTimeoutRef.current = null;
		}

		if (dataBatchRef.current.length === 0) return;

		const mergedData = dataBatchRef.current.join("");
		dataBatchRef.current = [];
		dataBatchCharsRef.current = 0;

		const xterm = xtermRef.current;
		if (!xterm || !isStreamReadyRef.current) {
			// Preserve ordering when readiness flips while we still have buffered data.
			pendingEventsRef.current.push({ type: "data", data: mergedData });
			return;
		}

		maxBatchCharsRef.current = Math.max(
			maxBatchCharsRef.current,
			mergedData.length,
		);
		flushCountRef.current++;

		updateModesFromData(mergedData);
		xterm.write(mergedData);
		updateCwdFromData(mergedData);

		if (
			DEBUG_TERMINAL &&
			(flushCountRef.current % 200 === 0 ||
				mergedData.length >= STREAM_MAX_BATCH_CHARS)
		) {
			console.log(
				`[Terminal] Stream batch stats: pane=${paneId}, flushes=${flushCountRef.current}, maxBatchChars=${maxBatchCharsRef.current}`,
			);
		}
	}, [
		paneId,
		xtermRef,
		isStreamReadyRef,
		pendingEventsRef,
		updateModesFromData,
		updateCwdFromData,
	]);

	const scheduleDataFlush = useCallback(() => {
		if (flushTimeoutRef.current) return;
		flushTimeoutRef.current = setTimeout(() => {
			flushTimeoutRef.current = null;
			flushDataBatch();
		}, STREAM_FLUSH_INTERVAL_MS);
	}, [flushDataBatch]);

	const enqueueData = useCallback(
		(data: string) => {
			dataBatchRef.current.push(data);
			dataBatchCharsRef.current += data.length;
			if (dataBatchCharsRef.current >= STREAM_MAX_BATCH_CHARS) {
				flushDataBatch();
				return;
			}
			scheduleDataFlush();
		},
		[flushDataBatch, scheduleDataFlush],
	);

	useEffect(() => {
		return () => {
			if (flushTimeoutRef.current) {
				clearTimeout(flushTimeoutRef.current);
				flushTimeoutRef.current = null;
			}
			dataBatchRef.current = [];
			dataBatchCharsRef.current = 0;
		};
	}, []);

	const handleTerminalExit = useCallback(
		(exitCode: number, xterm: XTerm, reason?: TerminalExitReason) => {
			if (
				!isTerminalStreamMountCurrent({
					paneId,
					token: streamMountToken,
				})
			) {
				if (DEBUG_TERMINAL) {
					console.log(
						`[Terminal] Dropping stale exit event: ${paneId}, code=${exitCode}, reason=${reason ?? "exited"}`,
					);
				}
				return;
			}

			isExitedRef.current = true;
			isStreamReadyRef.current = false;

			const wasKilledByUser = reason === "killed";
			wasKilledByUserRef.current = wasKilledByUser;
			setExitStatus(wasKilledByUser ? "killed" : "exited");

			if (wasKilledByUser) {
				xterm.writeln("\r\n\r\n[Session killed]");
				xterm.writeln("[Restart to start a new session]");
			} else {
				xterm.writeln(`\r\n\r\n[Process exited with code ${exitCode}]`);
				xterm.writeln("[Press any key to restart]");
			}

			// Clear transient pane status on terminal exit
			const currentPane = useTabsStore.getState().panes[paneId];
			if (
				currentPane?.status === "working" ||
				currentPane?.status === "permission"
			) {
				setPaneStatus(paneId, "idle");
			}
		},
		[
			paneId,
			streamMountToken,
			isExitedRef,
			isStreamReadyRef,
			wasKilledByUserRef,
			setExitStatus,
			setPaneStatus,
		],
	);

	const handleStreamError = useCallback(
		(event: Extract<TerminalStreamEvent, { type: "error" }>, xterm: XTerm) => {
			if (
				!isTerminalStreamMountCurrent({
					paneId,
					token: streamMountToken,
				})
			) {
				if (DEBUG_TERMINAL) {
					console.log(
						`[Terminal] Dropping stale error event: ${paneId}, code=${event.code ?? "UNKNOWN"}`,
					);
				}
				return;
			}

			const message = event.code
				? `${event.code}: ${event.error}`
				: event.error;
			console.warn("[Terminal] stream error:", message);

			if (
				event.code === "WRITE_FAILED" &&
				event.error?.includes("Session not found")
			) {
				setConnectionError("Session lost - click to reconnect");
				return;
			}

			if (
				event.code === "WRITE_FAILED" &&
				event.error?.includes("PTY not spawned")
			) {
				xterm.writeln(`\r\n[Terminal] ${message}`);
				return;
			}

			toast.error("Terminal error", { description: message });

			if (event.code === "WRITE_QUEUE_FULL" || event.code === "WRITE_FAILED") {
				xterm.writeln(`\r\n[Terminal] ${message}`);
			} else {
				setConnectionError(message);
			}
		},
		[paneId, streamMountToken, setConnectionError],
	);

	const handleStreamData = useCallback(
		(event: TerminalStreamEvent) => {
			if (
				!isTerminalStreamMountCurrent({
					paneId,
					token: streamMountToken,
				})
			) {
				if (DEBUG_TERMINAL) {
					const size = event.type === "data" ? event.data.length : 0;
					console.log(
						`[Terminal] Dropping stale stream event: ${paneId}, type=${event.type}, bytes=${size}`,
					);
				}
				return;
			}

			const xterm = xtermRef.current;

			// Queue ALL events until terminal is ready, preserving order
			// flushPendingEvents will process them in sequence after restore
			if (!xterm || !isStreamReadyRef.current) {
				flushDataBatch();
				if (DEBUG_TERMINAL && event.type === "data") {
					console.log(
						`[Terminal] Queuing event (not ready): ${paneId}, type=${event.type}, bytes=${event.data.length}`,
					);
				}
				pendingEventsRef.current.push(event);
				return;
			}

			// Process events when stream is ready
			if (event.type === "data") {
				enqueueData(event.data);
			} else if (event.type === "exit") {
				flushDataBatch();
				handleTerminalExit(event.exitCode, xterm, event.reason);
			} else if (event.type === "disconnect") {
				flushDataBatch();
				setConnectionError(
					event.reason || "Connection to terminal daemon lost",
				);
			} else if (event.type === "error") {
				flushDataBatch();
				handleStreamError(event, xterm);
			}
		},
		[
			paneId,
			streamMountToken,
			xtermRef,
			isStreamReadyRef,
			pendingEventsRef,
			handleTerminalExit,
			handleStreamError,
			setConnectionError,
			enqueueData,
			flushDataBatch,
		],
	);

	return {
		handleTerminalExit,
		handleStreamError,
		handleStreamData,
	};
}
