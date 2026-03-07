const DEFAULT_COORDS_FALLBACK = (lat, lng) => `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;

const GEOCODE_PREFERRED_KEYS = [
  "suburb",
  "neighbourhood",
  "village",
  "town",
  "city",
  "county",
  "state"
];

const geolocationPosition = (options) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const fetchJsonWithTimeout = async (url, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
};

export const getReadableLocation = async (lat, lng) => {
  try {
    const data = await fetchJsonWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&addressdetails=1&accept-language=en`,
      9000
    );

    const address = data?.address || {};
    const locality =
      GEOCODE_PREFERRED_KEYS.map((key) => address[key]).find(Boolean) || "";

    return {
      address: data?.display_name || DEFAULT_COORDS_FALLBACK(lat, lng),
      locality
    };
  } catch {
    return {
      address: DEFAULT_COORDS_FALLBACK(lat, lng),
      locality: ""
    };
  }
};

const getGpsLocation = async () => {
  const attempts = [
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    { enableHighAccuracy: true, timeout: 18000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  ];

  let best = null;

  for (const options of attempts) {
    try {
      const pos = await geolocationPosition(options);
      const accuracy = Number(pos?.coords?.accuracy || Infinity);

      if (!best || accuracy < best.accuracy) {
        best = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy
        };
      }

      // Accept early when accuracy is decent for city/service matching.
      if (accuracy <= 1200) {
        return best;
      }
    } catch {
      // Continue to next attempt.
    }
  }

  if (!best) {
    throw new Error("Could not get GPS location");
  }

  return best;
};

const getIpLocation = async () => {
  try {
    const ipapi = await fetchJsonWithTimeout("https://ipapi.co/json/", 7000);
    const lat = Number(ipapi?.latitude);
    const lng = Number(ipapi?.longitude);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const locality = [ipapi?.city, ipapi?.region, ipapi?.country_name]
        .filter(Boolean)
        .join(", ");

      return {
        lat,
        lng,
        locality: locality || "Approximate location"
      };
    }
  } catch {
    // Try secondary provider.
  }

  const ipinfo = await fetchJsonWithTimeout("https://ipinfo.io/json", 7000);
  const [latStr, lngStr] = String(ipinfo?.loc || "").split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Could not detect IP location");
  }

  const locality = [ipinfo?.city, ipinfo?.region, ipinfo?.country]
    .filter(Boolean)
    .join(", ");

  return {
    lat,
    lng,
    locality: locality || "Approximate location"
  };
};

export const detectUserLocation = async () => {
  try {
    const gps = await getGpsLocation();
    const readable = await getReadableLocation(gps.lat, gps.lng);

    return {
      source: "gps",
      isApproximate: false,
      accuracy: gps.accuracy,
      lat: gps.lat,
      lng: gps.lng,
      address: readable.address,
      locality: readable.locality,
      label: readable.locality || readable.address,
      type: "current"
    };
  } catch {
    const ip = await getIpLocation();
    const readable = await getReadableLocation(ip.lat, ip.lng);
    const locality = readable.locality || ip.locality;

    return {
      source: "ip",
      isApproximate: true,
      accuracy: null,
      lat: ip.lat,
      lng: ip.lng,
      address: readable.address || ip.locality,
      locality,
      label: locality ? `${locality} (approx)` : "Approximate location",
      type: "ip"
    };
  }
};
