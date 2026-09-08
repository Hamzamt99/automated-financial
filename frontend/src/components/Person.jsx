import { Link } from "react-router-dom";
import { initials } from "../utils.js";

export default function Person({ person, role = "عامل", linked = false, operator = false }) {
  if (!person) return <span className="muted">—</span>;
  const content = <><span className={`avatar ${operator ? "operator" : ""}`}>{initials(person.name)}</span><span><strong>{person.name}</strong><small>{role}</small></span></>;
  return linked ? <Link className="person linked" to={`/workers/${person.id}`}>{content}</Link> : <div className="person">{content}</div>;
}
