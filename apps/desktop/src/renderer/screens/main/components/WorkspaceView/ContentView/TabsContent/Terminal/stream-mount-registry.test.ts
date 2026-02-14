import { describe, expect, it } from "bun:test";
import {
	isTerminalStreamMountCurrent,
	registerTerminalStreamMount,
	resetTerminalStreamMountRegistryForTests,
	unregisterTerminalStreamMount,
} from "./stream-mount-registry";

describe("stream-mount-registry", () => {
	it("only treats the latest token for a pane as current", () => {
		resetTerminalStreamMountRegistryForTests();

		const paneId = "pane-1";
		const firstToken = "mount-1";
		const secondToken = "mount-2";

		registerTerminalStreamMount({ paneId, token: firstToken });
		expect(isTerminalStreamMountCurrent({ paneId, token: firstToken })).toBe(
			true,
		);

		registerTerminalStreamMount({ paneId, token: secondToken });
		expect(isTerminalStreamMountCurrent({ paneId, token: firstToken })).toBe(
			false,
		);
		expect(isTerminalStreamMountCurrent({ paneId, token: secondToken })).toBe(
			true,
		);
	});

	it("does not clear a newer token when an older mount unregisters", () => {
		resetTerminalStreamMountRegistryForTests();

		const paneId = "pane-1";
		const firstToken = "mount-1";
		const secondToken = "mount-2";

		registerTerminalStreamMount({ paneId, token: firstToken });
		registerTerminalStreamMount({ paneId, token: secondToken });

		unregisterTerminalStreamMount({ paneId, token: firstToken });
		expect(isTerminalStreamMountCurrent({ paneId, token: secondToken })).toBe(
			true,
		);

		unregisterTerminalStreamMount({ paneId, token: secondToken });
		expect(isTerminalStreamMountCurrent({ paneId, token: secondToken })).toBe(
			false,
		);
	});
});
