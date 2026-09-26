import { useCallback, useEffect, useRef, useState } from "react";

const DURATION_MS = { success: 3000, info: 3000, error: 6000 };

// Small self-written toast system: `notify(kind, message)` shows a
// short-lived message in the corner. Successes clear after 3s, errors stay
// for 6s; any toast can be dismissed early.
export function useToasts() {
	const [toasts, setToasts] = useState([]);
	const timersRef = useRef(new Map());
	const nextIdRef = useRef(1);

	const dismiss = useCallback((id) => {
		clearTimeout(timersRef.current.get(id));
		timersRef.current.delete(id);
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const notify = useCallback(
		(kind, message) => {
			const id = nextIdRef.current++;
			setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
			timersRef.current.set(
				id,
				setTimeout(() => dismiss(id), DURATION_MS[kind] ?? DURATION_MS.info),
			);
		},
		[dismiss],
	);

	useEffect(() => {
		const timers = timersRef.current;
		return () => timers.forEach((timer) => clearTimeout(timer));
	}, []);

	return { toasts, notify, dismiss };
}

export function ToastStack({ toasts, onDismiss }) {
	return (
		<div className="toast-stack" aria-live="polite">
			{toasts.map((toast) => (
				<div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
					<span className="toast-icon" aria-hidden="true">
						{toast.kind === "error" ? "!" : "✓"}
					</span>
					<span className="toast-message">{toast.message}</span>
					<button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
						×
					</button>
				</div>
			))}
		</div>
	);
}
