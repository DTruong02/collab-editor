import { Link } from 'react-router-dom'
import type { Document } from '../lib/api'

type DocCardProps = {
  document: Document
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function DocCard({ document }: DocCardProps) {
  return (
    <article className="doc-card">
      <div className="doc-card__body">
        <h2 className="doc-card__title">
          <Link to={`/docs/${document.id}`}>{document.title}</Link>
        </h2>
        <p className="doc-card__meta">
          Updated {formatDate(document.updated_at)}
        </p>
      </div>
      <Link className="doc-card__open" to={`/docs/${document.id}`}>
        Open
      </Link>
    </article>
  )
}
