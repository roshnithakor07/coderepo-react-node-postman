// Hand-written 16px stroke icons (no icon library — GUIDELINES §2.2).
// They inherit color from the surrounding text via currentColor.
function Icon({ children }) {
	return (
		<svg
			className="icon"
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{children}
		</svg>
	);
}

// Two overlapping squares.
export function CloneIcon() {
	return (
		<Icon>
			<rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
			<path d="M10.5 5.5V3.5A1 1 0 0 0 9.5 2.5H3.5A1 1 0 0 0 2.5 3.5V9.5A1 1 0 0 0 3.5 10.5H5.5" />
		</Icon>
	);
}

// Clipboard.
export function ClipboardIcon() {
	return (
		<Icon>
			<rect x="3.5" y="3" width="9" height="11" rx="1.5" />
			<rect x="6" y="1.75" width="4" height="2.5" rx="0.75" />
			<path d="M6 8h4M6 10.5h2.5" />
		</Icon>
	);
}

// Pencil.
export function PencilIcon() {
	return (
		<Icon>
			<path d="M10.75 2.75l2.5 2.5L6 12.5l-3.25.75.75-3.25z" />
			<path d="M9.25 4.25l2.5 2.5" />
		</Icon>
	);
}

// Trash can.
export function TrashIcon() {
	return (
		<Icon>
			<path d="M2.75 4.25h10.5" />
			<path d="M6.25 4.25V2.75h3.5v1.5" />
			<path d="M4 4.25l.6 8.6a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.6" />
			<path d="M6.75 7v4M9.25 7v4" />
		</Icon>
	);
}
