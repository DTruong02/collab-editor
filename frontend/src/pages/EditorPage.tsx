import { useParams } from 'react-router-dom'

export function EditorPage() {
  const { id } = useParams()

  return (
    <main className="page">
      <h1>Editor</h1>
      <p>Document: {id}</p>
    </main>
  )
}
