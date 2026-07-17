// ==========================================================================
// Modal.jsx — Reusable Overlay Modal
// ==========================================================================
// Renders a centered modal dialog with a dark overlay backdrop.
// Clicking the overlay closes the modal; clicking inside the modal content
// stops propagation to prevent accidental closure.
// Props: isOpen, onClose, title (optional), children
// ==========================================================================

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
