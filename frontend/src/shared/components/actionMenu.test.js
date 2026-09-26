import { describe, test, expect } from "bun:test";
import { computeMenuPosition, nextEnabledIndex } from "./actionMenu.js";

const viewport = { width: 1440, height: 900 };
const menu = { width: 200, height: 180 };
const trigger = (top, right = 280) => ({ top, bottom: top + 22, right, left: right - 22 });

describe("computeMenuPosition", () => {
	test("opens below, left edge aligned with the trigger (extends to the right)", () => {
		expect(computeMenuPosition(trigger(100), menu, viewport)).toEqual({ top: 126, left: 258, placement: "below" });
	});
	test("flips above near the bottom of the screen", () => {
		const pos = computeMenuPosition(trigger(820), menu, viewport);
		expect(pos.placement).toBe("above");
		expect(pos.top + menu.height).toBeLessThanOrEqual(820);
	});
	test("never leaves the viewport horizontally", () => {
		expect(computeMenuPosition(trigger(100, 20), menu, viewport).left).toBe(8);
		expect(computeMenuPosition(trigger(100, 1430), menu, viewport).left).toBe(1440 - 8 - 200);
	});
	test("a menu taller than the space on either side is clamped inside the viewport", () => {
		const pos = computeMenuPosition(trigger(40), { width: 200, height: 880 }, viewport);
		expect(pos.top).toBeGreaterThanOrEqual(8);
	});
});

describe("nextEnabledIndex", () => {
	test("moves down and up, wrapping around", () => {
		const d = [false, false, false];
		expect(nextEnabledIndex(d, -1, 1)).toBe(0);
		expect(nextEnabledIndex(d, 2, 1)).toBe(0);
		expect(nextEnabledIndex(d, 0, -1)).toBe(2);
	});
	test("skips disabled items; -1 when nothing is enabled", () => {
		expect(nextEnabledIndex([false, true, false], 0, 1)).toBe(2);
		expect(nextEnabledIndex([true, true], -1, 1)).toBe(-1);
	});
});
