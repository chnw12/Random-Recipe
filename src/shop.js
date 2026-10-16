// 쇼핑몰은 "검색 링크"만 만든다 (수집·크롤링 없음, 서버를 거치지 않음).
// 주의: 검색 URL 형식은 알려진 공개 형식을 쓴 것이며 이 개발 환경에서 접속 확인은 하지 못했다.
export const SHOPS = [
  { id: 'coupang', label: '쿠팡', url: (q) => `https://www.coupang.com/np/search?q=${encodeURIComponent(q)}` },
  { id: 'kurly', label: '마켓컬리', url: (q) => `https://www.kurly.com/search?sword=${encodeURIComponent(q)}` },
  { id: 'emart', label: '이마트몰', url: (q) => `https://emart.ssg.com/search.ssg?query=${encodeURIComponent(q)}` },
  { id: 'danawa', label: '다나와', url: (q) => `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(q)}` }
]
export const shopLinks = (name) => SHOPS.map((s) => ({ id: s.id, label: s.label, url: s.url(name) }))
