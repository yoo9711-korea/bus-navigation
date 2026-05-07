import fetch from "node-fetch";

export const handler = async (event: any) => {
  const keyword = event.queryStringParameters?.keyword;
  const key = process.env.GYEONGGI_BUS_API_KEY;

  const url =
    `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteListv2` +
    `?serviceKey=${key}&keyword=${encodeURIComponent(keyword)}&_type=json`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const items = data?.response?.msgBody?.busRouteList || [];

    const routes = (Array.isArray(items) ? items : [items]).map((r: any) => ({
      routeId: r.routeId,
      routeName: r.routeName,
      start: r.startStationName,
      end: r.endStationName,
      region: r.regionName,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(routes),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};