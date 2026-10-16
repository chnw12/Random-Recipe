import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme, useMediaQuery } from '@mui/material'
import { App } from './App.jsx'

function Root() {
  const dark = useMediaQuery('(prefers-color-scheme: dark)')
  const theme = useMemo(
    () =>
      createTheme({
        palette: dark
          ? { mode: 'dark', primary: { main: '#5cbf85', contrastText: '#0d1a12' }, background: { default: '#141a16', paper: '#1d2520' } }
          : { mode: 'light', primary: { main: '#2f7d4f' }, background: { default: '#fbfaf5', paper: '#ffffff' } },
        shape: { borderRadius: 14 },
        typography: { fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif", button: { fontWeight: 700, textTransform: 'none' } },
        components: { MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 44 } } } }
      }),
    [dark]
  )
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
