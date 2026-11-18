// Прогон настоящего page/index.js на заглушках API часов: магазин (открытие, покупка долгим нажатием, отказы, нет связи), жёлтый таймер.
// Запуск: node --import ./tests/register.mjs tests/page.test.mjs   (из папки приложения)
import assert from 'node:assert'

let n = 0
async function t(name, f) { await f(); n++; console.log('ok  ' + name) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = () => globalThis.__W.filter((w) => w.alive)
const shown = () => alive().filter((w) => w.visible)
const buttons = () => shown().filter((w) => w.type === 'BUTTON')
const texts = () => shown().filter((w) => w.type === 'TEXT').map((w) => w.props.text)
const imgs = () => shown().filter((w) => w.type === 'IMG').map((w) => w.props.src)
const press = (w) => w.props.click_func()
const hold = (w) => w.props.longpress_func()
const byImg = (src) => buttons().find((w) => w.props.normal_src === src)
const cellOf = (i) => globalThis.__W.filter((w) => w.type === 'BUTTON' && w.props.w === 120 && w.props.normal_color === 0 && w.props.press_color === 0x1c1c1c && w.props.text === '')[i]

// телефон 5.18: баланс b, цены p, получено событий
const phone = { online: true, f: true, b: 50, p: { '🍿': 12, '🌴': 30, '🍚': 5, '🥤': 7, '👁️': 0 }, got: [], buys: {} }
const fobj = () => ({ b: phone.b, p: phone.p })
globalThis.__REQ = (p) => {
  phone.got.push(p)
  if (!phone.online) return Promise.reject(new Error('offline'))
  if (p.t === 'sync') return Promise.resolve({ ok: true, reply: phone.f ? { t: 'sync', f: fobj(), g: { n: 0, h: 0 } } : { t: 'sync', g: { n: 3, h: 1 } } })
  if (p.t === 'buy') {
    if (!phone.buys[p.id]) { phone.buys[p.id] = true; phone.b -= p.c }   // повтор того же id ничего не меняет
    return Promise.resolve({ ok: true, reply: { t: 'ack', id: p.id, f: fobj(), g: { n: 0, h: 0 } } })
  }
  return Promise.resolve({ ok: true, reply: { t: 'ack', id: p.id, f: fobj(), g: { n: 0, h: 0 } } })
}
globalThis.Page = (o) => { globalThis.__PAGE = o }
await import('../page/index.js')
const page = globalThis.__PAGE
const buysSent = () => phone.got.filter((p) => p.t === 'buy')

await t('запуск: главный экран, магазин и жёлтый таймер построены, подарков нет', async () => {
  page.onInit()
  page.build()
  await sleep(20)
  assert.equal(globalThis.__STATUSBAR, false)
  assert.equal(byImg('i1.png') !== undefined, true)            // 💀 на месте
  assert.equal(alive().some((w) => String(w.props.normal_src || w.props.src) === 'g.png' || String(w.props.normal_src || w.props.src) === 'h.png'), false)
  assert.equal(alive().filter((w) => w.type === 'BUTTON' && w.props.normal_color === 0xffd21f).length, 2)   // жёлтый экран: цифры и полоса
})

await t('долгое нажатие на 🧬 и 🧭 больше ничего не делает; 💀 открывает магазин (зелёный таймер оттуда ушёл)', async () => {
  hold(byImg('i0.png'))
  hold(byImg('i4.png'))
  await sleep(10)
  assert.equal(imgs().includes('sh0.png'), false)
  assert.equal(buttons().some((w) => w.props.normal_color === 0x3bf76d), false)
  assert.equal(buttons().some((w) => w.props.normal_color === 0xff4517), false)
  hold(byImg('i1.png'))
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), true)
  for (let i = 0; i < 9; i++) assert.equal(imgs().includes('sh' + i + '.png'), true)
  assert.equal(imgs().includes('fl.png'), true)
})

await t('при открытии: баланс и цены берутся у телефона (sync), показаны 🌸50 и цены; у ⏳ — 2, у товара без цены подписи нет', async () => {
  assert.equal(phone.got.filter((p) => p.t === 'sync').length >= 2, true)   // при старте страницы и при открытии магазина
  const tx = texts()
  assert.equal(tx.includes('50'), true)
  assert.equal(tx.includes('2'), true)       // ⏳
  assert.equal(tx.includes('12'), true)      // 🍿
  assert.equal(tx.includes('30'), true)      // 🌴
  assert.equal(tx.includes('5'), true)       // 🍚
  assert.equal(tx.includes('7'), true)       // 🥤
  assert.equal(tx.includes('0'), true)       // 👁️ с ценой 0
  // 🧁 🫦 💬 — без цены: подписей цены у них нет (всего пять с числом + ⏳ ... проверяем по числу видимых значков цены)
  const priceFl = alive().filter((w) => w.type === 'IMG' && w.props.src === 'fs.png' && w.visible).length
  assert.equal(priceFl, 6)                   // ⏳ 🍿 🌴 🍚 🥤 👁️
})

await t('обычное нажатие на товар ничего не покупает; долгое — покупка: событие buy, баланс 50 -> 45 после ack', async () => {
  press(cellOf(3))
  await sleep(10)
  assert.equal(buysSent().length, 0)
  hold(cellOf(3))                            // 🍚 за 5
  await sleep(30)
  assert.equal(buysSent().length, 1)
  const b = buysSent()[0]
  assert.equal(b.t, 'buy')
  assert.equal(b.e, '🍚')
  assert.equal(b.c, 5)
  assert.equal(typeof b.ts, 'number')
  assert.equal(typeof b.id, 'string')
  assert.equal(phone.b, 45)
  assert.equal(texts().includes('45'), true)
})

await t('товары без цены (💬 🧁) не продаются: событий нет, баланс не меняется', async () => {
  hold(cellOf(8))                            // 💬: цены нет
  hold(cellOf(5))                            // 🧁: цены нет
  await sleep(20)
  assert.equal(buysSent().length, 1)
  assert.equal(phone.b, 45)
})

await t('👁️ с ценой 0 покупается; повтор события с тем же id баланс не меняет', async () => {
  hold(cellOf(7))
  await sleep(30)
  assert.equal(buysSent().length, 2)
  assert.equal(buysSent()[1].e, '👁️')
  assert.equal(buysSent()[1].e.length, 3)    // с селектором U+FE0F
  assert.equal(buysSent()[1].c, 0)
  assert.equal(phone.b, 45)
})

await t('🍿: списание 12 и СРАЗУ жёлтый таймер на 40 минут; на экране 40:00', async () => {
  hold(cellOf(1))
  await sleep(30)
  const b = buysSent()[2]
  assert.equal(b.e, '🍿')
  assert.equal(b.c, 12)
  assert.equal(phone.b, 33)
  assert.equal(shown().some((w) => w.type === 'BUTTON' && w.props.normal_color === 0xffd21f), true)
  assert.equal(buttons().some((w) => w.props.text === '40:00' || w.props.text === '39:59'), true)
  assert.equal(imgs().includes('sh0.png'), false)            // магазин закрылся: на экране таймер
})

await t('долгое нажатие на жёлтом — досрочный выход, телефону ничего не уходит, возврата нет; магазин снова открывается', async () => {
  const before = phone.got.length
  const y = buttons().find((w) => w.props.normal_color === 0xffd21f)
  hold(y)
  await sleep(30)
  assert.equal(shown().some((w) => w.props.normal_color === 0xffd21f), false)
  assert.equal(phone.got.slice(before).filter((p) => p.t !== 'sync').length, 0)
  assert.equal(phone.b, 33)
  hold(byImg('i1.png'))
  await sleep(30)
  assert.equal(texts().includes('33'), true)
})

await t('⏳: красный таймер, цена 2 за 1-й запуск за час; второй ⏳ в тот же час стоит 4', async () => {
  hold(cellOf(0))
  await sleep(30)
  const b = buysSent()[3]
  assert.equal(b.e, '⏳')
  assert.equal(b.c, 2)
  assert.equal(phone.b, 31)
  assert.equal(buttons().some((w) => w.props.normal_color === 0xff4517 && w.props.text !== ''), true)
  const r = buttons().find((w) => w.props.normal_color === 0xff4517)
  hold(r)                                    // выход из красного
  await sleep(30)
  hold(byImg('i1.png'))
  await sleep(30)
  assert.equal(texts().includes('4'), true)  // цена следующего ⏳ — 4
  hold(cellOf(0))
  await sleep(30)
  assert.equal(buysSent()[4].c, 4)           // купили второй
  assert.equal(phone.b, 27)
})

await t('не хватает баланса: 🌴 за 30 при 27 — отказ, ничего не списывается и таймер не запускается; ⏳ уже стоит 6', async () => {
  hold(buttons().find((w) => w.props.normal_color === 0xff4517))   // выход из красного (второй ⏳)
  await sleep(30)
  hold(byImg('i1.png'))
  await sleep(30)
  hold(cellOf(2))                            // 🌴 за 30 при 27
  await sleep(20)
  assert.equal(buysSent().length, 5)
  assert.equal(phone.b, 27)
  assert.equal(shown().some((w) => w.props.normal_color === 0x3bf76d), false)
  assert.equal(texts().includes('6'), true)  // третий ⏳ за последний час
})

await t('старый LuvU613 (ответ без поля f): «нет связи», ничего не продаётся', async () => {
  phone.f = false
  const bg = buttons().find((w) => w.props.w === 432 && w.props.normal_color === 0 && w.props.text === '')
  hold(bg)
  await sleep(20)
  hold(byImg('i1.png'))
  await sleep(40)
  assert.equal(texts().includes('нет связи'), true)
  const sent = buysSent().length
  hold(cellOf(3))
  await sleep(20)
  assert.equal(buysSent().length, sent)
})

await t('телефон недоступен при открытии: «нет связи», покупка отклоняется', async () => {
  const bg = buttons().find((w) => w.props.w === 432 && w.props.normal_color === 0 && w.props.text === '')
  hold(bg)
  await sleep(20)
  phone.f = true
  phone.online = false
  hold(byImg('i1.png'))
  await sleep(40)
  assert.equal(texts().includes('нет связи'), true)
  const sent = buysSent().length
  hold(cellOf(3))
  await sleep(20)
  assert.equal(buysSent().length, sent)
  phone.online = true
})

page.onDestroy()
console.log('\nВсе проверки страницы пройдены: ' + n)
process.exit(0)
