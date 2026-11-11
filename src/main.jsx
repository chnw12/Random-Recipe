import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { App } from './App.jsx'
import { createAppTheme } from './theme.js'

// 색·글꼴·버튼 모양은 theme.js 한 곳에서 관리한다. (라이트 테마 하나만 쓴다)
const theme = createAppTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
)
