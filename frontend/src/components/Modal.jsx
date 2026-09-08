import { X } from "lucide-react";

export default function Modal({ open, title, description, onClose, children, size = "small" }) {
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal ${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button></header>
      {children}
    </section>
  </div>;
}
