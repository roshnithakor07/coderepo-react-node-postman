import { useEffect, useRef } from "react";

// Reusable in-app replacement for window.confirm(), built entirely from the
// existing modal design system (.modal-overlay/.modal/.modal-header/
// .modal-body/.modal-footer/.btn-danger/.btn-ghost) — no new visual language.
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = "Cancel", onConfirm, onCancel }) {
	const cancelRef = useRef(null);

	useEffect(() => {
		cancelRef.current?.focus();
	}, []);

	// Registered on the capture phase, and stops propagation on Escape, so this
	// can be safely opened on top of an already-open modal (e.g. confirming an
	// environment delete while EnvironmentsModal is still mounted underneath,
	// which has its own bubble-phase Escape listener). Capture always runs
	// before bubble for the same document dispatch; stopping propagation here
	// prevents the event from ever reaching that underlying bubble-phase
	// listener, so one Escape press closes only this dialog. EnvironmentsModal
	// and SaveRequestModal's own Escape handling is untouched.
	useEffect(() => {
		const handler = (e) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				onCancel();
			}
		};
		document.addEventListener("keydown", handler, true);
		return () => document.removeEventListener("keydown", handler, true);
	}, [onCancel]);

	return (
		<div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
			<div className="modal confirm-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
				<div className="modal-header">
					<h2>{title}</h2>
				</div>
				<div className="modal-body">
					<p>{message}</p>
				</div>
				<div className="modal-footer">
					<button ref={cancelRef} className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
					<button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
				</div>
			</div>
		</div>
	);
}
