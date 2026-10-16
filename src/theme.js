// 디자인 토큰과 MUI 테마는 이 파일 한 곳에서만 관리한다.
// 화면 코드(screens.jsx, App.jsx, ui.jsx)는 색을 직접 쓰지 않고 theme 키('primary.main', 'text.secondary', 'divider' …)로만 참조한다.
import { createTheme } from '@mui/material'

export const tokens = {
  bg: '#F3F6EF', // 연한 민트/세이지 배경
  surface: '#FFFFFF', // 카드
  border: '#E7ECE2', // 카드 얇은 테두리
  primary: '#2A8453', // 포인트 그린 (버튼 배경, 아이콘). 흰 글자와의 대비 4.5:1 이상(AA)을 맞춘 값
  primaryDark: '#25774A', // 호버, 그리고 흰/연한 배경 위의 초록 "글자"(대비 4.5:1 이상)
  primarySoft: '#E4F2E9', // 활성 메뉴, 연한 강조 배경
  onPrimary: '#FFFFFF',
  text: '#1D2B22',
  textMuted: '#5E6E63',
  warn: '#9A5208', // 날생선 안내 글자
  warnSoft: '#FFF3E1',
  warnBorder: '#F0C98B',
  error: '#C2392F',
  scrollbar: '#C7D2C2',
  radius: { card: 16, control: 12, sheet: 24 }, // 카드 14~18px 범위
  font: "'Plus Jakarta Sans', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif"
}

const t = tokens

export function createAppTheme() {
  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: t.primary, dark: t.primaryDark, light: t.primarySoft, contrastText: t.onPrimary },
      warning: { main: t.warn, light: t.warnSoft, dark: t.warnBorder },
      error: { main: t.error },
      background: { default: t.bg, paper: t.surface },
      text: { primary: t.text, secondary: t.textMuted },
      divider: t.border,
      action: { selected: t.primarySoft }
    },
    shape: { borderRadius: t.radius.card },
    typography: {
      fontFamily: t.font,
      h5: { fontWeight: 800, letterSpacing: '-0.01em' },
      h6: { fontWeight: 800, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 800 },
      subtitle2: { fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 700, fontSize: 16 }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // 한국어는 단어 단위로 줄바꿈하고(keep-all), 아주 긴 문자열만 강제로 자른다. 스크롤바는 얇고 연하게.
          body: { WebkitFontSmoothing: 'antialiased', wordBreak: 'keep-all', overflowWrap: 'break-word' },
          '*': { scrollbarWidth: 'thin', scrollbarColor: `${t.scrollbar} transparent` }
        }
      },
      // 버튼: 크고 둥글게. contained = 그린 배경 + 흰 글자, outlined = 흰 배경 + 그린 테두리/글자
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 999, minHeight: 52, paddingInline: 24, fontSize: 16, '&.Mui-disabled': { opacity: 0.5 } },
          contained: { backgroundColor: t.primary, color: t.onPrimary, '&:hover': { backgroundColor: t.primaryDark }, '&.Mui-disabled': { backgroundColor: t.primary, color: t.onPrimary } },
          outlined: { borderWidth: 1.5, borderColor: t.primary, color: t.primaryDark, backgroundColor: t.surface, '&:hover': { borderWidth: 1.5, borderColor: t.primaryDark, backgroundColor: t.primarySoft }, '&.Mui-disabled': { borderWidth: 1.5, borderColor: t.primary, color: t.primaryDark } }
        }
      },
      MuiPaper: { styleOverrides: { outlined: { borderColor: t.border, borderRadius: t.radius.card, backgroundColor: t.surface } } },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 700, borderRadius: 999 },
          outlined: { borderColor: t.primary, color: t.primaryDark, backgroundColor: t.surface, '&.MuiChip-clickable:hover': { backgroundColor: t.primarySoft } },
          colorWarning: { backgroundColor: t.warnSoft, color: t.warn }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: t.radius.control, backgroundColor: t.surface, '& fieldset': { borderColor: t.border }, '&:hover fieldset': { borderColor: t.primary }, '&.Mui-focused fieldset': { borderColor: t.primary } }
        }
      },
      MuiIconButton: { styleOverrides: { root: { color: t.text, width: 44, height: 44 } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundColor: t.surface } } },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: t.radius.control, minHeight: 48, color: t.text,
            '&.Mui-selected': { backgroundColor: t.primarySoft, color: t.primaryDark },
            '&.Mui-selected:hover': { backgroundColor: t.primarySoft },
            '&:hover': { backgroundColor: t.bg }
          }
        }
      },
      MuiAlert: { styleOverrides: { filledInfo: { backgroundColor: t.text, color: t.surface, borderRadius: t.radius.control } } },
      MuiSkeleton: { styleOverrides: { root: { backgroundColor: t.primarySoft } } }
    }
  })
}
