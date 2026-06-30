import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { DocListPage } from './pages/DocListPage'
import { EditorPage } from './pages/EditorPage'
import { LoginPage } from './pages/LoginPage'
import { SpikePage } from './pages/SpikePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/spike" element={<SpikePage />} />
        <Route path="/" element={<LoginPage />} />
        <Route path="/docs" element={<DocListPage />} />
        <Route path="/docs/:id" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
