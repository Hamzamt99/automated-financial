import { money } from "../utils.js";

export default function AdditionsCell({ additions }) {
  if (!additions?.length) return <span className="muted">—</span>;
  return <div className="addition-tags">{additions.map((addition) => <span key={addition.code}>{addition.name} <b>{money(addition.price)}</b></span>)}</div>;
}
