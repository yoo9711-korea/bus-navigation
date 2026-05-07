import fetch from "node-fetch";

export const handler = async (event: any) => {
  const routeId = event.queryStringParameters?.routeId;
  const key = process.env.GYEONGGI_BUS_API_KEY;

  if (!routeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "routeId 없음" }),
    };
  }

  const url =
    `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteStationListv2` +
    `?serviceKey=${key}&routeId=${routeId}&_type=json`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const items = data?.response?.msgBody?.busRouteStationList || [];

    const list = Array.isArray(items) ? items : [items];

    const stations = list.map((s: any, i: number) => ({
      order: Number(s.stationSeq || i + 1),
      name: s.stationName,
      lat: Number(s.gpsY || 0),
      lng: Number(s.gpsX || 0),
    }));

    stations.sort((a, b) => a.order - b.order);

    return {
      statusCode: 200,
      body: JSON.stringify(stations),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "정류장 실패",
        detail: e.message,
      }),
    };
  }
};