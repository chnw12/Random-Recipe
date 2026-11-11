// 화면 공통 컴포넌트. 모든 화면이 같은 버튼·카드·헤더를 쓰도록 여기서만 모양을 정한다 (색은 theme.js 의 토큰을 theme 키로 참조).
import { AppBar, Box, Button, Chip, IconButton, Paper, Skeleton, Stack, Toolbar, Typography } from '@mui/material'
import { Icon } from './icons.jsx'
import { shopLinks } from './shop.js'

/** 버튼. tone="primary" = 그린 배경 + 흰 글자(주 행동, 확정 포함), tone="secondary" = 흰 배경 + 그린 테두리(보조 행동). 크고 둥글다. */
export function AppButton({ tone = 'primary', icon, children, ...rest }) {
  return (
    <Button variant={tone === 'primary' ? 'contained' : 'outlined'} size="large" fullWidth startIcon={icon ? <Icon name={icon} size={20} /> : undefined} {...rest}>
      {children}
    </Button>
  )
}

/** 카드: 흰 배경 + 얇은 테두리 + 둥근 모서리 (테마의 Paper outlined) */
export function Surface({ children, sx, ...rest }) {
  return <Paper variant="outlined" sx={{ p: 2, ...sx }} {...rest}>{children}</Paper>
}

/** 연한 그린 원 안의 아이콘 */
export function IconBadge({ name, size = 24, box = 44 }) {
  return (
    <Box sx={{ width: box, height: box, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.main', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Icon name={name} size={size} />
    </Box>
  )
}

export function Top({ title, onBack, onMenu }) {
  return (
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar sx={{ minHeight: 60, px: 1.5 }}>
        <Box sx={{ width: 48 }}>
          {onBack ? <IconButton aria-label="뒤로 가기" onClick={onBack}><Icon name="arrowLeft" size={22} /></IconButton>
            : onMenu && <IconButton aria-label="메뉴 열기" onClick={onMenu}><Icon name="menu" size={22} /></IconButton>}
        </Box>
        <Typography component="h1" variant="subtitle1" sx={{ flex: 1, textAlign: 'center' }}>{title}</Typography>
        <Box sx={{ width: 48, textAlign: 'right' }}>
          {onBack && onMenu && <IconButton aria-label="메뉴 열기" onClick={onMenu}><Icon name="menu" size={22} /></IconButton>}
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export const Body = ({ children, center }) => (
  <Stack spacing={1.75} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.5, py: 1.5, ...(center ? { alignItems: 'center', justifyContent: 'center', textAlign: 'center' } : {}) }}>{children}</Stack>
)

export const Foot = ({ children }) => (
  <Stack spacing={1.25} sx={{ px: 2.5, pt: 1.75, pb: 2.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>{children}</Stack>
)

/** 연한 그린 안내 줄 (예: "새 재료 3개로 바뀌었어요") */
export const Notice = ({ children, icon = 'refresh' }) => (
  <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'primary.light', color: 'primary.dark', borderRadius: 3, px: 1.75, py: 1.1, fontWeight: 700, fontSize: 14 }}>
    <Icon name={icon} size={18} />{children}
  </Box>
)

/** 주의 안내 줄 (날생선 안내) */
export const Caution = ({ children }) => (
  <Box role="note" sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'warning.light', color: 'warning.main', border: 1, borderColor: 'warning.dark', borderRadius: 3, px: 1.75, py: 1.1, fontSize: 14, fontWeight: 600 }}>
    <Icon name="flame" size={18} />{children}
  </Box>
)

export const Skel = ({ lines = 3 }) => (
  <Stack spacing={1.2} aria-busy="true" aria-label="불러오는 중">{Array.from({ length: lines }, (_, i) => <Skeleton key={i} variant="rounded" height={16} width={`${92 - i * 11}%`} />)}</Stack>
)

/** 쇼핑몰 4곳 검색 링크 */
export function ShopLinks({ name }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }} role="group" aria-label={`${name} 쇼핑몰 검색`}>
      {shopLinks(name).map((l) => (
        <Chip key={l.id} component="a" href={l.url} target="_blank" rel="noopener noreferrer" clickable variant="outlined" label={l.label} icon={<Icon name="external" size={14} />} />
      ))}
    </Stack>
  )
}
