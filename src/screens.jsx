import { useState } from 'react'
import { Box, Chip, CircularProgress, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, TextField, Typography } from '@mui/material'
import { SLOTS, getIngredient } from '../lib/ingredients.js'
import { recordConfirm } from './api.js'
import { addSpend, browserId, getSpend, spendStats, won } from './local.js'
import { Icon } from './icons.jsx'
import { AppButton, Body, Caution, Foot, IconBadge, Notice, ShopLinks, Skel, Surface, Top } from './ui.jsx'

/* ---------- 1. 메인 ---------- */
export function MainScreen({ onDraw, onMenu }) {
  return (
    <>
      <Top title="" onMenu={onMenu} />
      <Body center>
        <IconBadge name="leaf" size={52} box={104} />
        <Typography variant="h5" component="h2" sx={{ mt: 1 }}>오늘은 뭘 먹지?</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 300 }}>재료 3개를 무작위로 뽑으면, AI가 새 다이어트 메뉴로 조합해 줘요.</Typography>
        <Box sx={{ width: '100%', pt: 1 }}>
          <AppButton icon="shuffle" onClick={onDraw}>재료 3개 랜덤 뽑기</AppButton>
        </Box>
      </Body>
    </>
  )
}

/* ---------- 2. 재료 뽑기 ---------- */
export function DrawScreen({ picked, rolling, redrawn, creating, onBack, onMenu, onRedraw, onPrice, onCreate }) {
  const ready = picked.length === 3 && !rolling
  return (
    <>
      <Top title="재료 뽑기" onBack={onBack} onMenu={onMenu} />
      <Body>
        {redrawn && !rolling && <Notice>새 재료 3개로 바뀌었어요</Notice>}
        {SLOTS.map((s, i) => {
          const ing = picked.find((x) => x.slot === s.id)
          return (
            <Surface key={s.id} sx={{ p: 2.25, ...(rolling ? { opacity: 0.7 } : {}) }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.dark' }}>{s.label}</Typography>
              {rolling ? (
                <Typography variant="h5" sx={{ minHeight: 36 }} aria-hidden>{rolling[i]}</Typography>
              ) : ing ? (
                <Box component="button" onClick={() => onPrice(ing.id)} aria-label={`${ing.name} 가격 보기`} sx={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer' }}>
                  <Typography variant="h5">{ing.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>가격 보기</Typography>
                </Box>
              ) : null}
            </Surface>
          )
        })}
        <AppButton tone="secondary" icon="refresh" disabled={!!rolling || creating} onClick={onRedraw}>다시 뽑기</AppButton>
      </Body>
      <Foot>
        <AppButton icon={creating ? undefined : 'sparkles'} disabled={!ready || creating} onClick={onCreate}>
          {creating ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> 만드는 중…</> : '창조'}
        </AppButton>
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
        {!creating && menu.ingredients.some((i) => getIngredient(i.id)?.cook) && <Caution>날생선·해산물이 들어 있어요. 속까지 충분히 익혀서 드세요.</Caution>}
        {menu.mode === 'mock' && <Chip size="small" color="warning" label="예시 모드 · AI 없이 만든 예시 메뉴예요" sx={{ alignSelf: 'flex-start' }} />}
        {creating ? (
          <Surface sx={{ p: 2.5 }}><Skel lines={6} /></Surface>
        ) : (
          <Surface component="article" sx={{ p: 2.5 }}>
            <Typography variant="h6" component="h2">{menu.menuName}</Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary', mt: 0.5 }}>
              <Icon name="clock" size={15} /><Typography variant="caption">약 {menu.minutes}분 · {menu.servings}인분</Typography>
            </Stack>
            <Typography variant="subtitle2" sx={{ mt: 2.25, color: 'primary.dark' }}>재료</Typography>
            <Stack divider={<Divider flexItem />} sx={{ mb: 1.5 }}>
              {menu.ingredients.map((i) => (
                <Stack key={i.id} direction="row" sx={{ py: 1, justifyContent: 'space-between' }}><span>{i.name}</span><Typography component="span" color="text.secondary">{i.amount}</Typography></Stack>
              ))}
            </Stack>
            <Typography variant="subtitle2" sx={{ color: 'primary.dark' }}>조리 순서</Typography>
            <Box component="ol" sx={{ m: 0, mt: 0.5, pl: 2.75, '& li': { mb: 0.9, pl: 0.5 }, '& li::marker': { color: 'primary.main', fontWeight: 800 } }}>{menu.steps.map((s, i) => <li key={i}>{s}</li>)}</Box>
            {menu.references?.length > 0 && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>참고한 레시피: {menu.references.map((r) => `${r.title} (출처: ${r.source})`).join(', ')}</Typography>}
          </Surface>
        )}
      </Body>
      <Foot>
        <Stack direction="row" spacing={1.25}>
          <AppButton tone="secondary" disabled={creating} onClick={onRecreate}>{creating ? '만드는 중…' : '다시 창조'}</AppButton>
          <AppButton tone="secondary" disabled={creating} onClick={onRedraw}>다시 뽑기</AppButton>
        </Stack>
        <AppButton icon="check" disabled={creating} onClick={confirm}>이 메뉴로 확정</AppButton>
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
  return (
    <>
      <Top title="메뉴 확정" />
      <Body>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <IconBadge name="check" size={20} box={32} />
          <Typography sx={{ fontWeight: 800, color: 'primary.dark' }}>확정했어요</Typography>
        </Stack>
        <Typography variant="h5" component="h2">{menu.menuName}</Typography>
        <AppButton icon={copied ? 'check' : 'copy'} onClick={copy}>{copied ? '복사됨' : '레시피 복사'}</AppButton>
        <Surface sx={{ p: 2.25 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'primary.dark' }}>
            <Icon name="bag" size={18} /><Typography variant="subtitle2" sx={{ color: 'inherit' }}>재료 샀어요</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.25, mt: 0.5 }}>아직 수집된 가격이 없어요. 실제로 쓴 금액을 직접 입력해 저장하세요. (기록은 이 기기에만 저장됩니다)</Typography>
          <Stack spacing={1.25}>
            {rows.map(({ i }) => (
              <Stack key={i.id} direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{i.name}</span>
                <TextField size="small" value={vals[i.id] ?? ''} onChange={(e) => setVals({ ...vals, [i.id]: e.target.value })} placeholder="직접 입력" slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `${i.name} 가격(원)`, style: { textAlign: 'right' } }, input: { endAdornment: <span>원</span> } }} sx={{ width: 150 }}
                  error={(vals[i.id] ?? '').trim() !== '' && !/^\d{1,9}$/.test((vals[i.id] ?? '').trim())} />
              </Stack>
            ))}
            {invalid && <Typography color="error" variant="body2" role="alert">숫자만 입력해 주세요</Typography>}
            <AppButton tone="secondary" disabled={invalid || !any || spendSaved} onClick={saveSpend}>{spendSaved ? '저장됨' : '쓴 금액 저장'}</AppButton>
          </Stack>
        </Surface>
        <AppButton tone="secondary" icon="star" onClick={() => onToast('즐겨찾기는 준비 중이에요')}>즐겨찾기에 저장</AppButton>
      </Body>
      <Foot><AppButton tone="secondary" onClick={onHome}>홈으로</AppButton></Foot>
    </>
  )
}

/* ---------- 6. 사이드바(드로어): 아이콘 + 텍스트, 그룹, 활성 항목은 연한 그린 ---------- */
const DRAWER_GROUPS = [
  { title: '핵심 기능', items: [
    { s: 'draw', label: '재료 뽑기', icon: 'shuffle' },
    { s: 'exclude', label: '재료 제외', icon: 'ban', soon: true },
    { s: 'category', label: '카테고리', icon: 'grid', soon: true }
  ] },
  { title: '기록', items: [
    { s: 'favorites', label: '즐겨찾기', icon: 'star', soon: true },
    { s: 'stats', label: '평균 열량', icon: 'chart' }
  ] }
]
export function AppDrawer({ open, current, onClose, onGo }) {
  const active = ['main', 'draw', 'result', 'confirm'].includes(current) ? 'draw' : current // 뽑기 흐름 전체가 "재료 뽑기"
  return (
    <Drawer open={open} onClose={onClose} anchor="left" slotProps={{ paper: { sx: { width: 'min(300px, 84vw)', px: 1.5, py: 2.5, borderRadius: '0 24px 24px 0' } } }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 1, pb: 2.5 }}>
        <IconBadge name="leaf" size={24} box={44} />
        <Box>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>보조바퀴</Typography>
          <Typography variant="caption" color="text.secondary">다이어트 재료 뽑기</Typography>
        </Box>
      </Stack>
      <List component="nav" aria-label="메뉴" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 0 }}>
        {DRAWER_GROUPS.map((g) => (
          <Box key={g.title} role="group" aria-label={g.title}>
            <Typography variant="caption" sx={{ px: 1.5, fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>{g.title}</Typography>
            <Stack spacing={0.5} sx={{ mt: 0.75 }}>
              {g.items.map((d) => (
                <ListItemButton key={d.s} selected={d.s === active} aria-current={d.s === active ? 'page' : undefined} onClick={() => onGo(d.s)}>
                  <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}><Icon name={d.icon} size={21} /></ListItemIcon>
                  <ListItemText primary={d.label} slotProps={{ primary: { sx: { fontWeight: d.s === active ? 800 : 600 } } }} />
                  {d.soon && <Chip size="small" label="준비 중" sx={{ bgcolor: 'background.default', color: 'text.secondary', height: 22, fontSize: 11 }} />}
                </ListItemButton>
              ))}
            </Stack>
          </Box>
        ))}
      </List>
    </Drawer>
  )
}

/* ---------- 8. 평균 열량 (= 쓴 금액 통계) ---------- */
function Stat({ label, value, icon }) {
  return (
    <Surface sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2 }}>
      <IconBadge name={icon} size={20} box={40} />
      <Typography color="text.secondary" sx={{ flex: 1 }}>{label}</Typography>
      <Typography variant="h6">{value}</Typography>
    </Surface>
  )
}
export function StatsScreen({ onBack, onMenu }) {
  const [state] = useState(() => { try { return { s: spendStats(getSpend()) } } catch { return 'error' } })
  return (
    <>
      <Top title="평균 열량" onBack={onBack} onMenu={onMenu} />
      <Body>
        {state === 'error' ? <Typography align="center" color="text.secondary" sx={{ py: 4 }}>기록을 불러오지 못했어요</Typography> : !state.s.hasAny ? (
          <Typography align="center" color="text.secondary" sx={{ py: 4 }}>아직 기록이 없어요. 메뉴를 확정하고 재료 샀어요를 저장해 보세요.</Typography>
        ) : (
          <>
            <Stat icon="chart" label="이번 주 쓴 금액" value={won(state.s.week)} />
            <Stat icon="chart" label="이번 달 쓴 금액" value={won(state.s.month)} />
            {state.s.hasPrev && <Stat icon="refresh" label="지난달과의 차이" value={`${state.s.month - state.s.prevMonth >= 0 ? '+' : '−'}${won(Math.abs(state.s.month - state.s.prevMonth))}`} />}
          </>
        )}
        <Surface sx={{ p: 1.75, borderStyle: 'dashed' }}><Typography variant="body2" color="text.secondary">평균 열량은 아직 제공하지 않아요. 정확한 수치를 보장할 수 없어 이번 범위에서 제외했어요.</Typography></Surface>
        <Typography variant="caption" color="text.secondary">기록은 이 기기에만 저장됩니다.</Typography>
      </Body>
    </>
  )
}

/* ---------- 9. 재료 가격 시트 (가격은 3순위: 지금은 빈 상태 + 검색 링크) ---------- */
export function PriceSheet({ ingredientId, onClose }) {
  const ing = ingredientId ? getIngredient(ingredientId) : null
  return (
    <Drawer anchor="bottom" open={!!ing} onClose={onClose} slotProps={{ paper: { sx: { maxWidth: 444, mx: 'auto', borderRadius: '24px 24px 0 0', p: 2.5 } } }}>
      {ing && (
        <Stack spacing={1.5} role="dialog" aria-label={`${ing.name} 가격`}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="h2">{ing.name}</Typography>
            <IconButton aria-label="닫기" onClick={onClose}><Icon name="close" size={20} /></IconButton>
          </Stack>
          <Typography color="text.secondary">가격 정보가 아직 없어요. 검색 링크로 확인해 보세요.</Typography>
          <Typography variant="caption" color="text.secondary">구매처 검색</Typography>
          <ShopLinks name={ing.name} />
        </Stack>
      )}
    </Drawer>
  )
}

/* ---------- 준비 중 화면: 즐겨찾기 / 재료 제외 / 카테고리 (진입만 되고 기능은 아직 없음) ---------- */
export function ComingSoonScreen({ title, message, onBack, onMenu }) {
  return (
    <>
      <Top title={title} onBack={onBack} onMenu={onMenu} />
      <Body center>
        <IconBadge name="clock" size={36} box={80} />
        <Typography variant="h6" component="h2" sx={{ mt: 1 }}>준비 중이에요</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 300 }}>{message}</Typography>
        <Box sx={{ width: '100%', pt: 1 }}><AppButton tone="secondary" onClick={onBack}>돌아가기</AppButton></Box>
      </Body>
    </>
  )
}
