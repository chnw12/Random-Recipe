import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Container, Snackbar } from '@mui/material'
import { SLOTS, bySlot, drawThree, getIngredient } from '../lib/ingredients.js'
import { createMenu } from './api.js'
import { AppDrawer, ComingSoonScreen, ConfirmScreen, DrawScreen, MainScreen, PriceSheet, ResultScreen, StatsScreen } from './screens.jsx'

const ROLL_MS = 400 // 다시 뽑기는 0.5초 이내 (브라우저에서 처리, 서버를 거치지 않음)

export function App() {
  const [screen, setScreen] = useState('main')
  const [history, setHistory] = useState([])
  const [picked, setPicked] = useState([])
  const [rolling, setRolling] = useState(null)
  const [redrawn, setRedrawn] = useState(false)
  const [menu, setMenu] = useState(null)
  const [recreated, setRecreated] = useState(false)
  const [creating, setCreating] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [toast, setToast] = useState(null)
  const rollTimer = useRef()
  const rollEnd = useRef()

  const say = useCallback((msg, action) => setToast({ msg, action, key: Date.now() }), [])
  useEffect(() => () => { clearInterval(rollTimer.current); clearTimeout(rollEnd.current) }, [])

  const go = (s, { replace = false, reset = false } = {}) => {
    setToast(null) // 이전 화면의 알림이 다음 화면 버튼을 가리지 않게
    setDrawer(false)
    setSheet(null)
    setHistory((h) => (reset ? [] : replace ? h : [...h, screen]))
    setScreen(s)
  }
  const back = () => {
    setSheet(null)
    setHistory((h) => {
      setScreen(h[h.length - 1] ?? 'main')
      return h.slice(0, -1)
    })
  }

  /** 재료 3개 뽑기. 칸의 글자가 잠깐 빠르게 바뀐 뒤 확정된다. */
  const draw = (fromScreen) => {
    const res = drawThree()
    const cycle = () => SLOTS.map((s) => { const pool = bySlot(s.id); return pool[Math.floor(Math.random() * pool.length)].name })
    setRedrawn(fromScreen && picked.length > 0)
    if (!fromScreen) go('draw')
    setRolling(cycle())
    clearInterval(rollTimer.current)
    clearTimeout(rollEnd.current)
    rollTimer.current = setInterval(() => setRolling(cycle()), 70)
    rollEnd.current = setTimeout(() => {
      clearInterval(rollTimer.current)
      setRolling(null)
      setPicked(res.picked)
    }, ROLL_MS)
  }

  /** 창조 / 다시 창조. 실패하면 화면과 기존 결과는 그대로 두고 알림만 띄운다. */
  const create = async (ids, { recreate = false } = {}) => {
    if (creating) return
    setCreating(true)
    try {
      const data = await createMenu(ids, recreate ? menu?.menuName : undefined)
      setMenu(data)
      setRecreated(recreate)
      setPicked(ids.map(getIngredient).filter(Boolean))
      if (screen !== 'result') go('result')
    } catch (e) {
      say(recreate ? `새 메뉴를 만들지 못했어요. ${e.message}` : `메뉴를 만들지 못했어요. ${e.message}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Container maxWidth="xs" disableGutters sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {screen === 'main' && <MainScreen onDraw={() => draw(false)} onMenu={() => setDrawer(true)} />}
      {screen === 'draw' && (
        <DrawScreen picked={picked} rolling={rolling} redrawn={redrawn} creating={creating} onBack={back} onMenu={() => setDrawer(true)} onRedraw={() => draw(true)} onPrice={setSheet} onCreate={() => create(picked.map((p) => p.id))} />
      )}
      {screen === 'result' && menu && (
        <ResultScreen menu={menu} recreated={recreated} creating={creating} onBack={back} onRecreate={() => create(menu.ingredients.map((i) => i.id), { recreate: true })} onRedraw={() => { go('draw', { replace: true }); draw(true) }} onConfirmed={() => go('confirm')} />
      )}
      {screen === 'confirm' && menu && <ConfirmScreen menu={menu} onHome={() => go('main', { reset: true })} onToast={say} />}
      {screen === 'stats' && <StatsScreen onBack={back} onMenu={() => setDrawer(true)} />}
      {screen === 'favorites' && <ComingSoonScreen title="즐겨찾기" message="저장한 메뉴를 모아 보는 기능이에요. 아직 만드는 중이라 지금은 저장되지 않아요." onBack={back} onMenu={() => setDrawer(true)} />}
      {screen === 'exclude' && <ComingSoonScreen title="재료 제외" message="싫어하는 재료를 뽑기에서 빼는 기능이에요. 지금은 모든 재료에서 무작위로 뽑아요." onBack={back} onMenu={() => setDrawer(true)} />}
      {screen === 'category' && <ComingSoonScreen title="카테고리" message="지금은 '다이어트 식단' 하나만 있어요. 다른 분야는 준비 중이에요." onBack={back} onMenu={() => setDrawer(true)} />}

      <AppDrawer open={drawer} current={screen} onClose={() => setDrawer(false)} onGo={(s) => (s === 'draw' ? (setDrawer(false), draw(false)) : go(s))} />
      <PriceSheet ingredientId={sheet} onClose={() => setSheet(null)} />

      <Snackbar open={!!toast} key={toast?.key} autoHideDuration={4000} onClose={(_, r) => r !== 'clickaway' && setToast(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} sx={{ top: { xs: 60 } }}>
        <Alert severity="info" variant="filled" icon={false} sx={{ alignItems: 'center', bgcolor: 'text.primary', color: 'background.paper' }} action={toast?.action ? <Button color="inherit" size="small" sx={{ minHeight: 32, px: 1.5, color: 'inherit' }} onClick={() => { go(toast.action.go); setToast(null) }}>{toast.action.label}</Button> : undefined}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Container>
  )
}
