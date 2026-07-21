import { describe, expect, test } from "bun:test";
import {
	compareStatusesForDropdown,
	dedupeStatusesByName,
	isSameStatusName,
	normalizeStatusName,
} from "./sorting";

type StatusFixture = {
	id: string;
	name: string;
	color: string;
	type: string;
	position: number;
};

function status(
	id: string,
	name: string,
	type: string,
	position: number,
): StatusFixture {
	return { id, name, color: "#000", type, position };
}

// The default set every org is seeded with (see packages/db seed-default-statuses).
const DEFAULT_STATUSES: StatusFixture[] = [
	status("d-backlog", "Backlog", "backlog", 0),
	status("d-todo", "Todo", "unstarted", 1),
	status("d-progress", "In Progress", "started", 2),
	status("d-done", "Done", "completed", 3),
	status("d-canceled", "Canceled", "canceled", 4),
];

function names(list: StatusFixture[]): string[] {
	return list.map((s) => s.name);
}

describe("normalizeStatusName / isSameStatusName", () => {
	test("normalizes whitespace and case", () => {
		expect(normalizeStatusName("  In Progress ")).toBe("in progress");
	});

	test("matches names case- and whitespace-insensitively", () => {
		expect(isSameStatusName("In Progress", " in progress ")).toBe(true);
		expect(isSameStatusName("Backlog", "Todo")).toBe(false);
	});
});

describe("dedupeStatusesByName", () => {
	test("leaves default statuses untouched, sorted in workflow order", () => {
		const result = dedupeStatusesByName([...DEFAULT_STATUSES].reverse());
		expect(names(result)).toEqual([
			"Backlog",
			"Todo",
			"In Progress",
			"Done",
			"Canceled",
		]);
	});

	test("preserves custom Linear statuses (In Review, Duplicate)", () => {
		const custom: StatusFixture[] = [
			status("s-backlog", "Backlog", "backlog", 0),
			status("s-todo", "Todo", "unstarted", 1),
			status("s-progress", "In Progress", "started", 2),
			status("s-review", "In Review", "started", 3),
			status("s-done", "Done", "completed", 4),
			status("s-canceled", "Canceled", "canceled", 5),
			status("s-duplicate", "Duplicate", "canceled", 6),
		];
		const result = dedupeStatusesByName(custom);
		expect(names(result)).toEqual([
			"Backlog",
			"Todo",
			"In Progress",
			"In Review",
			"Done",
			"Canceled",
			"Duplicate",
		]);
	});

	test("collapses duplicate statuses from multiple Linear teams (the bug)", () => {
		// A workspace with three teams (DES, QA, INT) yields three of every
		// status — each with a distinct id but the same name.
		const multiTeam: StatusFixture[] = [
			status("des-backlog", "Backlog", "backlog", 0),
			status("des-todo", "Todo", "unstarted", 1),
			status("des-progress", "In Progress", "started", 2),
			status("qa-backlog", "Backlog", "backlog", 0),
			status("qa-todo", "Todo", "unstarted", 1),
			status("qa-progress", "In Progress", "started", 2),
			status("int-backlog", "Backlog", "backlog", 0),
			status("int-todo", "Todo", "unstarted", 1),
			status("int-progress", "In Progress", "started", 2),
		];
		const result = dedupeStatusesByName(multiTeam);
		// Each status name appears exactly once — not a run of "Backlog".
		expect(names(result)).toEqual(["Backlog", "Todo", "In Progress"]);
	});

	test("dedupes case- and whitespace-insensitively", () => {
		const result = dedupeStatusesByName([
			status("a", "Backlog", "backlog", 0),
			status("b", " backlog ", "backlog", 0),
			status("c", "BACKLOG", "backlog", 0),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("Backlog");
	});

	test("shows a renamed Linear status under its new name", () => {
		// "In Progress" renamed to "Working On It" in Linear.
		const renamed: StatusFixture[] = [
			status("s-backlog", "Backlog", "backlog", 0),
			status("s-working", "Working On It", "started", 2),
		];
		const result = dedupeStatusesByName(renamed);
		expect(names(result)).toContain("Working On It");
		expect(names(result)).not.toContain("In Progress");
	});

	test("keeps an unknown status type and never relabels it to Backlog", () => {
		// Linear's "triage" type is not one of the app's known types.
		const withUnknown: StatusFixture[] = [
			status("s-backlog", "Backlog", "backlog", 0),
			status("s-triage", "Triage", "triage", 0),
			status("s-done", "Done", "completed", 3),
		];
		const result = dedupeStatusesByName(withUnknown);
		// Triage is preserved with its real name...
		expect(names(result)).toContain("Triage");
		// ...appears exactly once...
		expect(names(result).filter((n) => n === "Triage")).toHaveLength(1);
		// ...and unknown types sort to the end, never collapsing into Backlog.
		expect(names(result)).toEqual(["Backlog", "Done", "Triage"]);
	});

	test("does not mutate the input array", () => {
		const input = [...DEFAULT_STATUSES].reverse();
		const snapshot = names(input);
		dedupeStatusesByName(input);
		expect(names(input)).toEqual(snapshot);
	});
});

describe("compareStatusesForDropdown", () => {
	test("orders by workflow type then position, unknown types last", () => {
		const sorted = [
			status("s-triage", "Triage", "triage", 0),
			status("s-progress", "In Progress", "started", 5),
			status("s-backlog", "Backlog", "backlog", 9),
		].sort(compareStatusesForDropdown);
		expect(names(sorted)).toEqual(["Backlog", "In Progress", "Triage"]);
	});
});
