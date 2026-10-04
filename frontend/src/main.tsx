import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Manufacturer from './Manufacturer.tsx'
import Login from './Login.tsx'

const pathname = window.location.pathname.replace(/\/$/, '')
const Page = pathname === '/manufacturer'
  ? Manufacturer
  : pathname === '/login'
    ? Login
    : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
