import { useEffect, useState } from 'react'
import {
  AppBar, Box, Button, Card, CardActionArea, Chip, CircularProgress, Collapse, Divider, Drawer, IconButton, List, ListItemButton, ListItemText,
  Paper, Skeleton, Stack, TextField, Toolbar, Typography
} from '@mui/material'
import { SLOTS, SLOT_LABEL, bySlot, getIngredient, slotsWithoutRemaining } from '../lib/ingredients.js'
import { recordConfirm } from './api.js'
import { addSpend, browserId, getCategory, getExcluded, getFavorites, getSpend, isFavorite, setExcluded, spendStats, toggleFavorite, won } from './local.js'
import { shopLinks } from './shop.js'

/* ---------- 공통 조각 ---------- */
function Top({ title, onBack, onMenu }) {
  return (
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar sx={{ minHeight: 52, px: 1 }}>
        <Box sx={{ width: 48 }}>
          {onBack && <IconButton aria-label="뒤로 가기" onClick={onBack}>←</IconButton>}
          {onMenu && <IconButton aria-label="메뉴 열기" onClick={onMenu}>☰</IconButton>}
        </Box>
        <Typography component="h1" variant="subtitle1" sx={{ flex: 1, textAlign: 'center', fontWeight: 800 }}>{title}</Typography>
        <Box sx={{ width: 48 }} />
      </Toolbar>
    </AppBar>
  )
}
const Body = ({ children, center }) => (
  <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.5, py: 1.5, ...(center ? { alignItems: 'center', justifyContent: 'center', textAlign: 'center' } : {}) }}>{children}</Stack>
)
const Foot = ({ children }) => (
  <Stack spacing={1} sx={{ px: 2.5, pt: 1.5, pb: 2.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>{children}</Stack>
)
const Notice = ({ children }) => (
  <Box sx={{ bgcolor: 'action.selected', color: 'primary.main', borderRadius: 2, px: 1.5, py: 1, fontWeight: 700, fontSize: 14 }} role="status">{children}</Box>
)
const Skel = ({ lines = 3 }) => (
  <Stack spacing={1.2} aria-busy="true" aria-label="불러오는 중">{Array.from({ length: lines }, (_, i) => <Skeleton key={i} variant="rounded" height={16} width={`${92 - i * 11}%`} />)}</Stack>
)

function ShopLinks({ name }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }} role="group" aria-label={`${name} 쇼핑몰 검색`}>
      {shopLinks(name).map((l) => (
        <Chip key={l.id} component="a" href={l.url} target="_blank" rel="noopener noreferrer" clickable label={`${l.label} ↗`} color="primary" variant="outlined" />
      ))}
    </Stack>
  )
}

/* ---------- 1. 메인 ---------- */
export function MainScreen({ onDraw, onMenu }) {
  return (
    <>
      <Top title="" onMenu={onMenu} />
      <Body center>
        <Typography sx={{ fontSize: 72, lineHeight: 1 }} aria-hidden>🥗</Typography>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>오늘은 뭘 먹지?</Typography>
        <Typography color="text.secondary">재료 3개를 무작위로 뽑으면, AI가 새 다이어트 메뉴로 조합해 줘요.</Typography>
        <Button variant="contained" size="large" fullWidth onClick={onDraw} sx={{ minHeight: 52, fontSize: 16 }}>재료 3개 랜덤 뽑기</Button>
      </Body>
    </>
  )
}

/* ---------- 2. 재료 뽑기 ---------- */
export function DrawScreen({ picked, rolling, emptySlots, redrawn, creating, onBack, onRedraw, onPrice, onCreate, onExclude }) {
  const ready = picked.length === 3 && emptySlots.length === 0 && !rolling
  return (
    <>
      <Top title="재료 뽑기" onBack={onBack} />
      <Body>
        {redrawn && !rolling && <Notice>새 재료 3개로 바뀌었어요</Notice>}
        {SLOTS.map((s, i) => {
          const ing = picked.find((x) => x.slot === s.id)
          const empty = emptySlots.includes(s.id)
          return (
            <Paper key={s.id} variant="outlined" sx={{ p: 2, ...(rolling ? { opacity: 0.7 } : {}) }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{s.label}</Typography>
              {empty ? (
                <Typography color="warning.main">뽑을 재료가 없어요 <Button size="small" onClick={onExclude}>재료 제외 화면으로</Button></Typography>
              ) : rolling ? (
                <Typography variant="h5" sx={{ fontWeight: 800, minHeight: 36 }} aria-hidden>{rolling[i]}</Typography>
              ) : ing ? (
                <Box component="button" onClick={() => onPrice(ing.id)} aria-label={`${ing.name} 가격 보기`} sx={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer' }}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{ing.name}</Typography>
                  <Typography variant="caption" color="primary">가격 보기</Typography>
                </Box>
              ) : null}
            </Paper>
          )
        })}
        <Button variant="outlined" color="inherit" disabled={!!rolling || creating} onClick={onRedraw}>↻ 다시 뽑기</Button>
      </Body>
      <Foot>
        <Button variant="contained" size="large" disabled={!ready || creating} onClick={onCreate} sx={{ minHeight: 52, fontSize: 16 }}>
          {creating ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> 만드는 중…</> : '✨ 창조'}
        </Button>
      </Foot>
    </>
  )
}

/* ---------- 4. 메뉴 결과 ---------- */
export function ResultScreen({ menu, recreated, creating, onBack, onRecreate, onRedraw, onConfirmed }) {
  const confirm = () => {
    // 확정 기록은 응답을 기다리지 않는다 (실패해도 흐름을 막지 않음)
    recordConfirm({ browserId: browserId(), menuName: menu.menuName, ingredientIds: menu.ingredients.map((i) => i.id) })
    onConfirmed()
  }
  return (
    <>
      <Top title="메뉴 결과" onBack={onBack} />
      <Body>
        {recreated && !creating && <Notice>같은 재료 · 새 메뉴</Notice>}
        {menu.mode === 'mock' && <Chip size="small" color="warning" label="예시 모드 · AI 없이 만든 예시 메뉴예요" sx={{ alignSelf: 'flex-start' }} />}
        {creating ? (
          <Paper variant="outlined" sx={{ p: 2 }}><Skel lines={6} /></Paper>
        ) : (
          <Paper variant="outlined" component="article" sx={{ p: 2.5 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>{menu.menuName}</Typography>
            <Typography variant="caption" color="text.secondary">⏱ 약 {menu.minutes}분 · {menu.servings}인분</Typography>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>재료</Typography>
            <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />} sx={{ mb: 1 }}>
              {menu.ingredients.map((i) => (
                <Stack key={i.id} direction="row" sx={{ py: 0.75, justifyContent: 'space-between' }}><span>{i.name}</span><Typography component="span" color="text.secondary">{i.amount}</Typography></Stack>
              ))}
            </Stack>
            <Typography variant="subtitle2" color="text.secondary">조리 순서</Typography>
            <Box component="ol" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.75 } }}>{menu.steps.map((s, i) => <li key={i}>{s}</li>)}</Box>
            {menu.references?.length > 0 && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>참고한 레시피: {menu.references.map((r) => `${r.title} (${r.source})`).join(', ')}</Typography>}
          </Paper>
        )}
      </Body>
      <Foot>
        <Button variant="contained" size="large" disabled={creating} onClick={confirm} sx={{ minHeight: 52, fontSize: 16 }}>이 메뉴로 확정</Button>
        <Stack direction="row" spacing={1}>
          <Button fullWidth variant="outlined" color="inherit" disabled={creating} onClick={onRecreate}>{creating ? '만드는 중…' : '다시 창조'}</Button>
          <Button fullWidth variant="outlined" color="inherit" disabled={creating} onClick={onRedraw}>다시 뽑기</Button>
        </Stack>
      </Foot>
    </>
  )
}

/* ---------- 5. 메뉴 확정 ---------- */
export const recipeText = (m) =>
  `${m.menuName}\n약 ${m.minutes}분 · ${m.servings}인분\n\n[재료]\n${m.ingredients.map((i) => `- ${i.name} ${i.amount}`).join('\n')}\n\n[조리 순서]\n${m.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`

export function ConfirmScreen({ menu, onHome, onToast }) {
  const [copied, setCopied] = useState(false)
  const [vals, setVals] = useState({})
  const [spendSaved, setSpendSaved] = useState(false)
  const [fav, setFav] = useState(() => isFavorite(menu.menuName))
  const rows = menu.ingredients.map((i) => ({ i, raw: (vals[i.id] ?? '').trim() }))
  const invalid = rows.some(({ raw }) => raw !== '' && !/^\d{1,9}$/.test(raw))
  const any = rows.some(({ raw }) => raw !== '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recipeText(menu))
      setCopied(true)
      onToast('레시피를 복사했어요')
    } catch {
      onToast('복사하지 못했어요')
    }
  }
  const saveSpend = () => {
    const items = rows.filter(({ raw }) => raw !== '').map(({ i, raw }) => ({ id: i.id, name: i.name, price: Number(raw) }))
    if (!addSpend({ at: Date.now(), menuName: menu.menuName, items, total: items.reduce((a, x) => a + x.price, 0) })) return onToast('저장하지 못했어요')
    setSpendSaved(true)
    onToast('쓴 금액을 저장했어요', { label: '통계 보기', go: 'stats' })
  }
  const saveFav = () => {
    const r = toggleFavorite(menu)
    if (!r.ok) return onToast('저장하지 못했어요')
    setFav(r.saved)
    onToast(r.saved ? '즐겨찾기에 저장했어요' : '즐겨찾기를 해제했어요', r.saved ? { label: '보기', go: 'favorites' } : undefined)
  }
  return (
    <>
      <Top title="메뉴 확정" />
      <Body>
        <Typography color="primary" sx={{ fontWeight: 800 }}>✔ 확정했어요</Typography>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>{menu.menuName}</Typography>
        <Button variant="contained" size="large" onClick={copy} sx={{ minHeight: 52, fontSize: 16 }}>{copied ? '복사됨 ✓' : '레시피 복사'}</Button>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">재료 샀어요</Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>아직 수집된 가격이 없어요. 실제로 쓴 금액을 직접 입력해 저장하세요. (기록은 이 기기에만 저장됩니다)</Typography>
          <Stack spacing={1}>
            {rows.map(({ i }) => (
              <Stack key={i.id} direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{i.name}</span>
                <TextField size="small" value={vals[i.id] ?? ''} onChange={(e) => setVals({ ...vals, [i.id]: e.target.value })} placeholder="직접 입력" slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `${i.name} 가격(원)`, style: { textAlign: 'right' } }, input: { endAdornment: <span>원</span> } }} sx={{ width: 150 }}
                  error={(vals[i.id] ?? '').trim() !== '' && !/^\d{1,9}$/.test((vals[i.id] ?? '').trim())} />
              </Stack>
            ))}
            {invalid && <Typography color="error" variant="body2" role="alert">숫자만 입력해 주세요</Typography>}
            <Button variant="outlined" color="inherit" disabled={invalid || !any || spendSaved} onClick={saveSpend}>{spendSaved ? '저장됨 ✓' : '쓴 금액 저장'}</Button>
          </Stack>
        </Paper>
        <Button variant="outlined" color="inherit" onClick={saveFav}>{fav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기에 저장'}</Button>
      </Body>
      <Foot><Button variant="outlined" color="inherit" size="large" onClick={onHome}>홈으로</Button></Foot>
    </>
  )
}

/* ---------- 6. 메뉴 드로어 ---------- */
const DRAWER_ITEMS = [
  { s: 'draw', label: '재료 뽑기', desc: '재료 3개를 무작위로 뽑아요' },
  { s: 'favorites', label: '즐겨찾기', desc: '저장한 메뉴와 재료 구매 링크' },
  { s: 'exclude', label: '재료 제외', desc: '싫어하는 재료를 뽑기에서 빼요' },
  { s: 'category', label: '카테고리', desc: '어떤 분야의 재료로 뽑을지 골라요' },
  { s: 'stats', label: '평균 열량', desc: '쓴 금액 통계 (열량은 준비 중)' }
]
export function AppDrawer({ open, current, onClose, onGo }) {
  return (
    <Drawer open={open} onClose={onClose} anchor="left" slotProps={{ paper: { sx: { width: 'min(300px, 82vw)' } } }}>
      <Typography sx={{ fontWeight: 800, p: 2.5 }}>메뉴</Typography>
      <List component="nav" aria-label="메뉴">
        {DRAWER_ITEMS.map((d) => (
          <ListItemButton key={d.s} selected={d.s === current} aria-current={d.s === current ? 'page' : undefined} onClick={() => onGo(d.s)}>
            <ListItemText primary={d.label} secondary={d.desc} slotProps={{ primary: { sx: { fontWeight: 700 } } }} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  )
}

/* ---------- 7. 즐겨찾기 ---------- */
export function FavoritesScreen({ onBack, onGoDraw, onError }) {
  const [favs, setFavs] = useState(getFavorites)
  const [open, setOpen] = useState(null)
  const unfav = (f) => {
    if (!toggleFavorite(f.menu).ok) return onError('저장하지 못했어요')
    setFavs(getFavorites())
    if (open === f.id) setOpen(null)
  }
  return (
    <>
      <Top title="즐겨찾기" onBack={onBack} />
      <Body>
        {favs.length === 0 && (
          <Stack spacing={2} sx={{ py: 4, alignItems: 'center' }}><Typography color="text.secondary">아직 저장한 메뉴가 없어요</Typography><Button variant="contained" onClick={onGoDraw}>재료 뽑으러 가기</Button></Stack>
        )}
        {favs.map((f) => (
          <Paper key={f.id} variant="outlined">
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Box component="button" aria-expanded={open === f.id} onClick={() => setOpen(open === f.id ? null : f.id)} sx={{ all: 'unset', flex: 1, p: 2, cursor: 'pointer' }}>
                <Typography sx={{ fontWeight: 800 }}>{f.menu.menuName}</Typography>
                <Typography variant="caption" color="text.secondary">{f.menu.ingredients.map((i) => i.name).join(' · ')}</Typography>
              </Box>
              <IconButton aria-label="즐겨찾기 해제" color="primary" onClick={() => unfav(f)}>★</IconButton>
            </Stack>
            <Collapse in={open === f.id} unmountOnExit>
              <Stack spacing={1} sx={{ px: 2, pb: 2, borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">가격은 아직 수집 전이에요. 재료를 사러 가기 (검색 링크):</Typography>
                {f.menu.ingredients.map((i) => (
                  <Stack key={i.id} direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><span>{i.name}</span><ShopLinks name={i.name} /></Stack>
                ))}
              </Stack>
            </Collapse>
          </Paper>
        ))}
      </Body>
    </>
  )
}

/* ---------- 8. 평균 열량 (= 쓴 금액 통계) ---------- */
export function StatsScreen({ onBack }) {
  const [state] = useState(() => { try { return { s: spendStats(getSpend()) } } catch { return 'error' } })
  const Stat = ({ label, value }) => <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><Typography color="text.secondary">{label}</Typography><Typography variant="h6" sx={{ fontWeight: 800 }}>{value}</Typography></Paper>
  return (
    <>
      <Top title="평균 열량" onBack={onBack} />
      <Body>
        {state === 'error' ? <Typography align="center" color="text.secondary" sx={{ py: 4 }}>기록을 불러오지 못했어요</Typography> : !state.s.hasAny ? (
          <Typography align="center" color="text.secondary" sx={{ py: 4 }}>아직 기록이 없어요. 메뉴를 확정하고 재료 샀어요를 저장해 보세요.</Typography>
        ) : (
          <>
            <Stat label="이번 주 쓴 금액" value={won(state.s.week)} />
            <Stat label="이번 달 쓴 금액" value={won(state.s.month)} />
            {state.s.hasPrev && <Stat label="지난달과의 차이" value={`${state.s.month - state.s.prevMonth >= 0 ? '+' : '−'}${won(Math.abs(state.s.month - state.s.prevMonth))}`} />}
          </>
        )}
        <Paper variant="outlined" sx={{ p: 1.5, borderStyle: 'dashed' }}><Typography variant="body2" color="text.secondary">평균 열량은 아직 제공하지 않아요. 정확한 수치를 보장할 수 없어 이번 범위에서 제외했어요.</Typography></Paper>
        <Typography variant="caption" color="text.secondary">기록은 이 기기에만 저장됩니다.</Typography>
      </Body>
    </>
  )
}

/* ---------- 9. 재료 가격 시트 (가격은 3순위: 지금은 빈 상태 + 검색 링크) ---------- */
export function PriceSheet({ ingredientId, onClose }) {
  const ing = ingredientId ? getIngredient(ingredientId) : null
  return (
    <Drawer anchor="bottom" open={!!ing} onClose={onClose} slotProps={{ paper: { sx: { maxWidth: 444, mx: 'auto', borderRadius: '20px 20px 0 0', p: 2.5 } } }}>
      {ing && (
        <Stack spacing={1.5} role="dialog" aria-label={`${ing.name} 가격`}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>{ing.name}</Typography><IconButton aria-label="닫기" onClick={onClose}>✕</IconButton></Stack>
          <Typography color="text.secondary">가격 정보가 아직 없어요. 검색 링크로 확인해 보세요.</Typography>
          <Typography variant="caption" color="text.secondary">구매처 검색</Typography>
          <ShopLinks name={ing.name} />
        </Stack>
      )}
    </Drawer>
  )
}

/* ---------- 10. 재료 제외 ---------- */
export function ExcludeScreen({ onBack, onSaved, onError }) {
  const [ex, setEx] = useState(() => new Set(getExcluded().filter(getIngredient)))
  const [err, setErr] = useState('')
  const toggle = (id) => {
    setEx((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    setErr('')
  }
  const save = () => {
    const bad = slotsWithoutRemaining(ex)
    if (bad.length) return setErr(`칸마다 재료가 1개 이상 남아야 해요 (${bad.map((b) => SLOT_LABEL[b]).join(', ')})`)
    if (!setExcluded([...ex])) return onError('저장하지 못했어요')
    onSaved()
  }
  return (
    <>
      <Top title="재료 제외" onBack={onBack} />
      <Body>
        <Typography color="text.secondary">제외한 재료 {ex.size}개 · 이 기기에만 저장됩니다.</Typography>
        {SLOTS.map((s) => (
          <Paper key={s.id} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{s.label}</Typography>
            <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: 'wrap' }}>
              {bySlot(s.id).map((i) => (
                <Chip key={i.id} clickable label={i.name} aria-pressed={ex.has(i.id)} onClick={() => toggle(i.id)} color={ex.has(i.id) ? 'default' : 'primary'} variant={ex.has(i.id) ? 'filled' : 'outlined'}
                  sx={ex.has(i.id) ? { bgcolor: 'text.primary', color: 'background.paper', textDecoration: 'line-through', '&:hover': { bgcolor: 'text.primary' } } : undefined} />
              ))}
            </Stack>
          </Paper>
        ))}
        {err && <Typography color="error" role="alert">{err}</Typography>}
      </Body>
      <Foot><Button variant="contained" size="large" onClick={save} sx={{ minHeight: 52, fontSize: 16 }}>저장</Button></Foot>
    </>
  )
}

/* ---------- 11. 카테고리 ---------- */
const CATEGORIES = [{ id: 'diet', label: '다이어트 식단', ready: true }, { id: 'soon1', label: '자취 간편식', ready: false }, { id: 'soon2', label: '디저트', ready: false }]
export function CategoryScreen({ onBack, onToast }) {
  const sel = getCategory()
  return (
    <>
      <Top title="카테고리" onBack={onBack} />
      <Body>
        {CATEGORIES.map((c) => (
          <Card key={c.id} variant="outlined" sx={c.id === sel ? { borderColor: 'primary.main' } : undefined}>
            <CardActionArea aria-pressed={c.id === sel} onClick={() => (c.ready ? onBack() : onToast('아직 준비 중이에요'))} sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 800 }}>{c.label}</Typography>
              {c.id === sel ? <Chip size="small" color="primary" label="선택됨" /> : !c.ready && <Chip size="small" label="준비 중" />}
            </CardActionArea>
          </Card>
        ))}
      </Body>
    </>
  )
}
