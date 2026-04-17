import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { DeckViewer } from './DeckViewer'

export function DeckViewerPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  if (!slug) return <Navigate to="/" replace />

  return (
    <DeckViewer
      slug={slug}
      onBack={() => {
        if (window.history.length > 1) navigate(-1)
        else navigate('/')
      }}
    />
  )
}

export default DeckViewerPage
