// Pure helpers for ActionMenu: where to place it and how arrow keys move.

// Aligns the menu's left edge with its trigger (so it opens to the right,
// over the workspace, rather than back over the sidebar list) and opens below
// it; flips above when there isn't room below (and there's more room above),
// and always stays inside the viewport with `margin` px to spare.
export function computeMenuPosition(trigger, menu, viewport, { gap = 4, margin = 8 } = {}) {
	const spaceBelow = viewport.height - trigger.bottom - gap - margin;
	const spaceAbove = trigger.top - gap - margin;
	const placement = menu.height <= spaceBelow || spaceBelow >= spaceAbove ? "below" : "above";
	let top = placement === "below" ? trigger.bottom + gap : trigger.top - gap - menu.height;
	top = Math.min(Math.max(top, margin), Math.max(margin, viewport.height - margin - menu.height));
	let left = trigger.left;
	left = Math.min(Math.max(left, margin), Math.max(margin, viewport.width - margin - menu.width));
	return { top: Math.round(top), left: Math.round(left), placement };
}

// Index of the next enabled item from `current` in direction `delta`,
// wrapping around; -1 if every item is disabled. current = -1 starts before
// the first item (so delta 1 gives the first enabled item).
export function nextEnabledIndex(disabled, current, delta) {
	const n = disabled.length;
	if (n === 0) return -1;
	let i = current;
	for (let step = 0; step < n; step++) {
		i = (((i + delta) % n) + n) % n;
		if (!disabled[i]) return i;
	}
	return -1;
}
