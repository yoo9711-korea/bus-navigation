export default async function handler(req, res) {
  const routeNo = req.query.routeNo
  const routeId = req.query.routeId
  const key = process.env.GYEONGGI_BUS_API_KEY

  if (!key) {
    return res.status(500).json({ ok: false, message: "API KEY 없음" })
  }

  // 🔥 안전 JSON 파서
  async function safeJson(response) {
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  // ============================
  // 🚏 STOPS
  // ============================
  async function getStops(routeId) {
    const url =
      `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteStationListv2` +
      `?serviceKey=${key}&routeId=${routeId}&_type=json`

    const resApi = await fetch(url)
    const json = await safeJson(resApi)

    const items =
      json?.response?.msgBody?.busRouteStationList ||
      json?.response?.body?.items?.item ||
      []

    const list = Array.isArray(items) ? items : [items]

   const result = list.map((p) => ({
  seq: Number(p.seq || p.nodeSeq || 0),
  lat: Number(p.gpsY || p.y || 0),
  lng: Number(p.gpsX || p.x || 0),
}))

    result.sort((a, b) => a.order - b.order)
    return result
  }

  // ============================
  // 🛣 ROUTE LINE
  // ============================
  async function getRouteLine(routeId) {
    const url =
      `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteLineListv2` +
      `?serviceKey=${key}&routeId=${routeId}&_type=json`

    const resApi = await fetch(url)
    const json = await safeJson(resApi)

    const items =
      json?.response?.msgBody?.busRouteLineList ||
      json?.response?.body?.items?.item ||
      []

    const list = Array.isArray(items) ? items : [items]

    const result = list.map((p) => ({
      seq: Number(p.seq || p.nodeSeq || 0),
      lat: Number(p.gpsY || p.y || 0),
      lng: Number(p.gpsX || p.x || 0),
    }))

    result.sort((a, b) => a.seq - b.seq)

    const unique = []
    const seen = new Set()

    for (const p of result) {
      const key = `${p.lat}-${p.lng}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(p)
      }
    }

    return unique
  }

  // ============================
  // 🚍 ROUTE SEARCH
  // ============================
  async function searchRouteList(routeNo) {
    const url =
      `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteListv2` +
      `?serviceKey=${key}&keyword=${routeNo}&_type=json`

    const resApi = await fetch(url)
    const json = await safeJson(resApi)

    const items =
      json?.response?.msgBody?.busRouteList ||
      []

    return (Array.isArray(items) ? items : [items]).map((r) => ({
      routeId: r.routeId,
      routeName: r.routeName,
      regionName: r.regionName,
      startStation: r.startStationName,
      endStation: r.endStationName,
    }))
  }

  try {
    // 1️⃣ routeId 없으면 → 검색
    if (!routeId) {
      const routes = await searchRouteList(routeNo)

      return res.status(200).json({
        ok: true,
        mode: "route-options",
        routes,
      })
    }

    // 2️⃣ 상세 데이터
    const stops = await getStops(routeId)
    const routeLine = await getRouteLine(routeId)

    return res.status(200).json({
      ok: true,
      routeNo,
      routeId,
      stopCount: stops.length,
      stops,
      routeLine,
      routeLineCount: routeLine.length,
    })
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: String(e),
    })
  }
}
