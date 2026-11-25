import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { registerServiceWorker } from './push/push.ts'
import './styles.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
void registerServiceWorker()
