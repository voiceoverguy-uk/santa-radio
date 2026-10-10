import { Link } from 'react-router-dom';
export default function Breadcrumbs({ items }) {
  return <nav className="seo-breadcrumbs" aria-label="Breadcrumb"><ol>{items.map(([name, path], i) => <li key={path}>{i === items.length - 1 ? <span aria-current="page">{name}</span> : <Link to={path}>{name}</Link>}</li>)}</ol></nav>;
}
