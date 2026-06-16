import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { DocListPage } from './pages/DocListPage'
import { EditorPage } from './pages/EditorPage'
import { LoginPage } from './pages/LoginPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/docs" element={<DocListPage />} />
        <Route path="/docs/:id" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
