import { useEffect } from "react";

export function useDialogDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);
}

export const closeOnBackdrop = <T extends HTMLElement>(
  event: React.MouseEvent<T>,
  onClose: () => void,
) => {
  if (event.target === event.currentTarget) onClose();
};
