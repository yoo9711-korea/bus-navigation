import type { Handler } from "@netlify/functions"

export const handler: Handler = async (event) => {
  const routeNo = event.queryStringParameters?.routeNo

  if (!routeNo) {
    return { statusCode: 400, body: "routeNo required" }
  }

  const key = process.env.INCHEON_BUS_API_KEY

  const url = `https://apis.data.go.kr/6280000/busRouteService/getBusRouteList?serviceKey=${key}&keyword=${routeNo}`

  try {
    const res = await fetch(url)
    const text = await res.text()

    console.log("인천 검색 XML:", text)

    let routeIdMatch =
      text.match(/<route_id>(.*?)<\/route_id>/) ||
      text.match(/<routeId>(.*?)<\/routeId>/)

    if (!routeIdMatch) {
      console.log("인천 routeId 못찾음")
      return {
        statusCode: 200,
        body: JSON.stringify({ routeLine: [] })
      }
    }

    const routeId = routeIdMatch[1]
    console.log("인천 routeId:", routeId)

    const lineUrl = `https://apis.data.go.kr/6280000/busRouteService/getRouteShape?serviceKey=${key}&route_id=${routeId}`

    const lineRes = await fetch(lineUrl)
    const lineText = await lineRes.text()

    console.log("인천 노선 XML:", lineText)

    // 🔥 핵심 수정 (줄바꿈 대응)
    const coords = [
      ...lineText.matchAll(/<x>(.*?)<\/x>[\s\S]*?<y>(.*?)<\/y>/g)
    ]

    const routeLine = coords.map(c => ({
      lat: parseFloat(c[2]),
      lng: parseFloat(c[1])
    }))

    console.log("인천 좌표 개수:", routeLine.length)

    return {
      statusCode: 200,
      body: JSON.stringify({ routeLine })
    }

  } catch (e) {
    console.error(e)
    return { statusCode: 500, body: "error" }
  }
}