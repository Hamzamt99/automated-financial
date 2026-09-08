import { AlertTriangle } from "lucide-react";
import Modal from "./Modal.jsx";

export default function ConfirmModal({ open, title, message, busy, onConfirm, onClose }) {
  return <Modal open={open} title={title} description={message} onClose={onClose}>
    <div className="confirm-symbol"><AlertTriangle size={28} /></div>
    <div className="modal-actions"><button className="button danger" disabled={busy} onClick={onConfirm}>{busy ? "جارٍ الحذف..." : "نعم، احذف"}</button><button className="button secondary" onClick={onClose}>إلغاء</button></div>
  </Modal>;
}
