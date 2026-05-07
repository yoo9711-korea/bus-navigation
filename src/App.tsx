import { useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    kakao: any
  }
}

type Route = {
  routeId: string
  routeName: string
  regionName?: string
  startStation?: string
  endStation?: string
}

type Stop = {
  order: number
  name: string
  lat: number
  lng: number
}

const KAKAO_KEY = "e4321e6c521521cad9e2f41e45e74128"

export default function App() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<any>(null)

  const myMarker = useRef<any>(null)
  const polylineRef = useRef<any>(null)

  const lastStop = useRef<string | null>(null)
  const watchId = useRef<number | null>(null)

  const simIndex = useRef(0)
  const simTimer = useRef<any>(null)

  const prevPos = useRef<{ lat: number; lng: number } | null>(null)

  const voiceUnlocked = useRef(false)

  const speedRef = useRef(2000)

  const [speed, setSpeed] = useState(2000)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStop, setCurrentStop] = useState("")

  const [routeNo, setRouteNo] = useState("")
  const [routes, setRoutes] = useState<Route[]>([])
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [detail, setDetail] = useState<any>(null)

  // 🗺 지도 초기화
  useEffect(() => {
    const script = document.createElement("script")
    script.src =
      "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" +
      KAKAO_KEY +
      "&autoload=false"

    document.head.appendChild(script)

    script.onload = () => {
      window.kakao.maps.load(() => {
        mapObj.current = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(37.5665, 126.9780),
          level: 7,
        })
      })
    }
  }, [])

  // 🔊 음성 (유지)
  const speak = (text: string) => {
    if (!voiceUnlocked.current) return

    speechSynthesis.cancel()

    setTimeout(() => {
      const msg = new SpeechSynthesisUtterance(text)
      msg.lang = "ko-KR"
      msg.rate = 0.7
      speechSynthesis.speak(msg)
    }, 120)
  }

  const enableVoice = () => {
    const msg = new SpeechSynthesisUtterance("음성 활성화 완료")
    msg.lang = "ko-KR"
    msg.rate = 0.7
    speechSynthesis.speak(msg)
    voiceUnlocked.current = true
  }

  // 🗺 라인
  const drawRouteLine = (stops: Stop[]) => {
    if (!mapObj.current || !stops?.length) return

    const path = stops.map(
      (s) => new window.kakao.maps.LatLng(s.lat, s.lng)
    )

    if (polylineRef.current) {
      polylineRef.current.setMap(null)
    }

    polylineRef.current = new window.kakao.maps.Polyline({
      path,
      strokeWeight: 5,
      strokeColor: "#ff0000",
      strokeOpacity: 0.9,
      map: mapObj.current,
    })
  }

  // 📏 거리 계산
  const getDistance = (a: any, b: Stop) => {
    const R = 6371000
    const dLat = ((b.lat - a.lat) * Math.PI) / 180
    const dLng = ((b.lng - a.lng) * Math.PI) / 180

    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2

    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
    return R * c
  }

  // 🧭 방향 계산
  const getDirection = (from: any, to: any) => {
    const dx = to.lng - from.lng
    const dy = to.lat - from.lat

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "우회전" : "좌회전"
    } else {
      return dy > 0 ? "직진" : "후진"
    }
  }

  // 🚨 GPS (핵심 수정)
  const startGPS = () => {
    if (!navigator.geolocation) return

    watchId.current = navigator.geolocation.watchPosition((pos) => {
      const current = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }

      if (!mapObj.current) return

      const position = new window.kakao.maps.LatLng(
        current.lat,
        current.lng
      )

      if (!myMarker.current) {
        myMarker.current = new window.kakao.maps.Marker({
          position,
          map: mapObj.current,
        })
      } else {
        myMarker.current.setPosition(position)
      }

      mapObj.current.panTo(position)

      if (detail?.stops?.length) {
        const stops: Stop[] = detail.stops

        let nearest: Stop | null = null
        let minDist = 999999

        for (const s of stops) {
          const dist = getDistance(current, s)

          if (dist < minDist) {
            minDist = dist
            nearest = s
          }
        }

        if (nearest) {
          const direction = getDirection(current, nearest)

          // 🟡 80m 사전 안내
          if (minDist <= 80 && minDist > 50) {
            speak(`앞으로 ${direction} 예정입니다`)
          }

          // 🔴 50m 실제 안내
          if (minDist <= 50) {
            speak(`${direction}하세요`)
          }

          prevPos.current = current
        }
      }
    })
  }

  const stopGPS = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }

  // 🚍 시뮬레이션 (GPS 동일 로직 적용)
  const startSimulation = () => {
    if (!detail?.stops?.length) return

    setIsRunning(true)
    simIndex.current = 0

    const run = () => {
      const stops: Stop[] = detail.stops

      if (simIndex.current >= stops.length) {
        setIsRunning(false)
        return
      }

      const stop = stops[simIndex.current]
      const next = stops[simIndex.current + 1]

      if (next) {
        const dist = getDistance(stop, next)
        const dir = getDirection(stop, next)

        if (dist <= 80 && dist > 50) {
          speak(`앞으로 ${dir} 예정입니다`)
        }

        if (dist <= 50) {
          speak(`${dir}하세요`)
        }
      }

      if (mapObj.current) {
        const pos = new window.kakao.maps.LatLng(stop.lat, stop.lng)

        if (!myMarker.current) {
          myMarker.current = new window.kakao.maps.Marker({
            position: pos,
            map: mapObj.current,
          })
        } else {
          myMarker.current.setPosition(pos)
        }

        mapObj.current.panTo(pos)
      }

      simIndex.current++

      simTimer.current = setTimeout(run, speedRef.current)
    }

    run()
  }

  const stopSimulation = () => {
    clearTimeout(simTimer.current)
    setIsRunning(false)
  }

  // 🔍 검색
  const searchRoutes = async () => {
    setRoutes([])
    setSelectedRoute(null)
    setDetail(null)

    const res = await fetch(
      `/.netlify/functions/gyeonggi-route?routeNo=${routeNo}`
    )

    const data = await res.json()

    setRoutes(data.routes || [])
  }

  const selectRoute = async (route: Route) => {
    setSelectedRoute(route)

    const res = await fetch(
      `/.netlify/functions/gyeonggi-route?routeNo=${routeNo}&routeId=${route.routeId}`
    )

    const data = await res.json()

    setDetail(data)

    if (data?.stops?.length) {
      drawRouteLine(data.stops)
    }
  }

  return (
    <div>
      <div style={{ padding: 10 }}>
        <h3>🚍 GPS + 시뮬레이션 (80m/50m 방향 안내)</h3>

        <button onClick={enableVoice}>🔊 음성 활성화</button>

        <button onClick={startGPS}>GPS 시작</button>
        <button onClick={stopGPS}>GPS 종료</button>

        <button onClick={startSimulation}>시뮬레이션 시작</button>
        <button onClick={stopSimulation}>시뮬레이션 종료</button>

        <input
          value={routeNo}
          onChange={(e) => setRouteNo(e.target.value)}
        />

        <button onClick={searchRoutes}>검색</button>
      </div>

      <div ref={mapRef} style={{ width: "100%", height: "60vh" }} />

      {routes.length > 0 && !selectedRoute && (
        <div style={{ padding: 10 }}>
          {routes.map((r, i) => (
            <div
              key={i}
              onClick={() => selectRoute(r)}
              style={{ padding: 10, border: "1px solid #ccc" }}
            >
              <b>{r.routeName}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}