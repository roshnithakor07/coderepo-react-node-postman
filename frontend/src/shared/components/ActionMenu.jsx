import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computeMenuPosition, nextEnabledIndex } from "./actionMenu.js";

// A small ⋯-style action menu, rendered into document.body with fixed
// positioning so no scroll container (the sidebar) or later sibling can clip
// or cover it. It opens below its trigger and flips above near the bottom of
// the screen.
//
// items: [{ id, label, icon, onSelect, danger?, async?, busyLabel? } | { divider: true }]
// An `async` item (e.g. Clone) keeps the menu open and busy — every item
// disabled, Esc and outside clicks ignored — until its promise settles.
//
// Keyboard: focus starts on the first item; ↑/↓ (and Home/End) move between
// enabled items; Enter/Space selects; Esc closes and returns focus to the
// trigger; Tab closes.
export function ActionMenu({ anchorRef, items, onClose, label }) {
	const menuRef = useRef(null);
	const itemRefs = useRef([]);
	const [position, setPosition] = useState(null);
	const [busyId, setBusyId] = useState(null);
	const busy = busyId !== null;
	const actionable = items.filter((item) => !item.divider);

	const place = useCallback(() => {
		const anchor = anchorRef.current;
		const menu = menuRef.current;
		if (!anchor || !menu) return;
		setPosition(
			computeMenuPosition(
				anchor.getBoundingClientRect(),
				{ width: menu.offsetWidth, height: menu.offsetHeight },
				{ width: window.innerWidth, height: window.innerHeight },
			),
		);
	}, [anchorRef]);

	// Measure and place before the first paint, then focus the first item.
	useLayoutEffect(() => {
		place();
		itemRefs.current[0]?.focus();
	}, [place]);

	const close = useCallback(
		(returnFocus) => {
			onClose();
			if (returnFocus) anchorRef.current?.focus();
		},
		[onClose, anchorRef],
	);

	useEffect(() => {
		function onPointerDown(e) {
			if (busy) return;
			if (menuRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
			close(false);
		}
		document.addEventListener("mousedown", onPointerDown);
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [busy, close, place, anchorRef]);

	function focusItem(delta, from) {
		const disabled = actionable.map(() => busy);
		const current = from ?? itemRefs.current.indexOf(document.activeElement);
		const next = nextEnabledIndex(disabled, current, delta);
		if (next !== -1) itemRefs.current[next]?.focus();
	}

	function onKeyDown(e) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			focusItem(1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			focusItem(-1);
		} else if (e.key === "Home") {
			e.preventDefault();
			focusItem(1, -1);
		} else if (e.key === "End") {
			e.preventDefault();
			focusItem(-1, actionable.length);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			if (!busy) close(true);
		} else if (e.key === "Tab") {
			if (!busy) close(false);
		}
	}

	async function select(item) {
		if (busy) return;
		if (item.async) {
			setBusyId(item.id);
			await item.onSelect();
			onClose();
			return;
		}
		onClose();
		item.onSelect();
	}

	let actionIndex = -1;
	return createPortal(
		<div
			ref={menuRef}
			className="action-menu"
			role="menu"
			aria-label={label}
			aria-busy={busy}
			onKeyDown={onKeyDown}
			// React events bubble through the component tree even from a portal;
			// keep clicks from reaching e.g. the collection header's toggle.
			onClick={(e) => e.stopPropagation()}
			style={position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }}
			data-placement={position?.placement}
		>
			{items.map((item, i) => {
				if (item.divider) return <div key={`divider-${i}`} className="action-menu-divider" role="separator" />;
				actionIndex += 1;
				const index = actionIndex;
				const isBusy = busyId === item.id;
				return (
					<button
						key={item.id}
						ref={(el) => (itemRefs.current[index] = el)}
						type="button"
						role="menuitem"
						className={`action-menu-item${item.danger ? " danger" : ""}`}
						disabled={busy}
						aria-busy={isBusy}
						tabIndex={-1}
						onClick={() => select(item)}
					>
						<span className="action-menu-icon">
							{isBusy ? <span className="action-menu-spinner" aria-hidden="true" /> : item.icon}
						</span>
						<span className="action-menu-label">{isBusy ? item.busyLabel || item.label : item.label}</span>
					</button>
				);
			})}
		</div>,
		document.body,
	);
}
