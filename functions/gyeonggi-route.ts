export default async function handler(req, res) {
  const routeNo = req.query.routeNo
  const routeId = req.query.routeId

  const key =
    process.env.GYEONGGI_BUS_API_KEY

  // ============================
  // API KEY 체크
  // ============================
  if (!key) {
    return res.status(500).json({
      ok: false,
      message: "API KEY 없음",
    })
  }

  // ============================
  // 안전 JSON 파서
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
  // 노선 좌표 가져오기
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

    // 정렬
    result.sort(
      (a, b) => a.seq - b.seq
    )

    // 중복 제거
    const unique = []

    const seen = new Set()

    for (const p of result) {
      const key =
        `${p.lat}-${p.lng}`

      if (
        p.lat &&
        p.lng &&
        !seen.has(key)
      ) {
        seen.add(key)
        unique.push(p)
      }
    }

    return unique
  }

  // ============================
  // 정류장 좌표 자동 보정
  // ============================
  function attachStopCoords(
    stops,
    routeLine
  ) {
    if (!routeLine.length) {
      return stops
    }

    const total =
      routeLine.length

    return stops.map((s, i) => {
      // routeLine 비율 기반
      const idx = Math.floor(
        (i / stops.length) * total
      )

      const point =
        routeLine[
          Math.min(
            idx,
            total - 1
          )
        ]

      return {
        ...s,
        lat: point?.lat || 0,
        lng: point?.lng || 0,
      }
    })
  }

  // ============================
  // 정류장 목록
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

    const result = list.map(
      (s, i) => ({
        order: Number(
          s.stationSeq || i + 1
        ),

        name:
          s.stationName ||
          s.bstopNm ||
          "알수없음",

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
  // 노선 검색
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
    // 노선 검색
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
    // 상세 데이터
    // ============================
    let stops =
      await getStops(routeId)

    const routeLine =
      await getRouteLine(routeId)

    // 🔥 stops 좌표 자동 보정
    stops = attachStopCoords(
      stops,
      routeLine
    )

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
