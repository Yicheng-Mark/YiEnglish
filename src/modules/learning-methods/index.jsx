import { Routes, Route } from 'react-router-dom'
import LearningMethodsHome from './pages/LearningMethodsHome'
import MethodDetail from './pages/MethodDetail'

export default function LearningMethodsModule() {
  return (
    <Routes>
      <Route index element={<LearningMethodsHome />} />
      <Route path=":id" element={<MethodDetail />} />
    </Routes>
  )
}
