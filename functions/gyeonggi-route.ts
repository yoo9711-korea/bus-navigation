export default async function handler(req, res) {
  const routeNo = req.query.routeNo
  const routeId = req.query.routeId

  const key =
    process.env.GYEONGGI_BUS_API_KEY

  // ============================
  // ❌ API KEY 없음
  // ============================
  if (!key) {
    return res.status(500).json({
      ok: false,
      message: "API KEY 없음",
    })
  }

  // ============================
  // 🔥 안전 JSON 파서
  // ============================
  async function safeJson(response) {
    const text = await response.text()

    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  // ============================
  // 🚏 정류장 목록
  // ============================
  async function getStops(routeId) {
    const url =
      `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteStationListv2` +
      `?serviceKey=${key}&routeId=${routeId}&_type=json`

    const resApi = await fetch(url)

    const json =
      await safeJson(resApi)

    const items =
      json?.response?.msgBody
        ?.busRouteStationList ||
      json?.response?.body
        ?.items?.item ||
      []

    const list = Array.isArray(items)
      ? items
      : [items]

    // ⚠️ 경기버스 일부 노선은
    // 정류장 좌표를 제공하지 않음
    // 그래서 name/order 위주 사용
    const result = list.map(
      (s, i) => ({
        order: Number(
          s.stationSeq || i + 1
        ),

        name:
          s.stationName ||
          s.bstopNm ||
          "알수없음",

        // 좌표 없는 경우 0 유지
        lat: Number(
          s.gpsY ||
          s.y ||
          s.stationLatitude ||
          0
        ),

        lng: Number(
          s.gpsX ||
          s.x ||
          s.stationLongitude ||
          0
        ),
      })
    )

    result.sort(
      (a, b) => a.order - b.order
    )

    return result
  }

  // ============================
  // 🛣 노선 좌표
  // ============================
  async function getRouteLine(routeId) {
    const url =
      `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteLineListv2` +
      `?serviceKey=${key}&routeId=${routeId}&_type=json`

    const resApi = await fetch(url)

    const json =
      await safeJson(resApi)

    const items =
      json?.response?.msgBody
        ?.busRouteLineList ||
      json?.response?.body
        ?.items?.item ||
      []

    const list = Array.isArray(items)
      ? items
      : [items]

    // 🔥 seq 없는 경우
    // index(i)로 자동 보정
    const result = list.map(
      (p, i) => ({
        seq: Number(
          p.seq ||
          p.nodeSeq ||
          i
        ),

        lat: Number(
          p.gpsY ||
          p.y ||
          0
        ),

        lng: Number(
          p.gpsX ||
          p.x ||
          0
        ),
      })
    )

    // 순서 정렬
    result.sort(
      (a, b) => a.seq - b.seq
    )

    // ============================
    // 🔥 중복 좌표 제거
    // ============================
    const unique = []

    const seen = new Set()

    for (const p of result) {
      const key =
        `${p.lat}-${p.lng}`

      if (!seen.has(key)) {
        seen.add(key)
        unique.push(p)
      }
    }

    return unique
  }

  // ============================
  // 🚍 노선 검색
  // ============================
  async function searchRouteList(
    routeNo
  ) {
    const url =
      `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteListv2` +
      `?serviceKey=${key}&keyword=${routeNo}&_type=json`

    const resApi = await fetch(url)

    const json =
      await safeJson(resApi)

    const items =
      json?.response?.msgBody
        ?.busRouteList || []

    const list = Array.isArray(items)
      ? items
      : [items]

    return list.map((r) => ({
      routeId: r.routeId,

      routeName:
        r.routeName,

      regionName:
        r.regionName,

      startStation:
        r.startStationName,

      endStation:
        r.endStationName,
    }))
  }

  try {
    // ============================
    // 🔍 노선 검색
    // ============================
    if (!routeId) {
      const routes =
        await searchRouteList(
          routeNo
        )

      return res.status(200).json({
        ok: true,
        mode: "route-options",
        routes,
      })
    }

    // ============================
    // 🛣 상세 데이터
    // ============================
    const stops =
      await getStops(routeId)

    const routeLine =
      await getRouteLine(routeId)

    return res.status(200).json({
      ok: true,

      routeNo,
      routeId,

      stopCount:
        stops.length,

      stops,

      routeLineCount:
        routeLine.length,

      routeLine,
    })
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: String(e),
    })
  }
}
