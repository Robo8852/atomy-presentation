import { Navigate, Route, Routes } from 'react-router-dom'
import { DeckList } from './components/DeckList'
import { DeckViewerPage } from './components/DeckViewerPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<DeckList />} />
      <Route path="/decks/:slug" element={<DeckViewerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
