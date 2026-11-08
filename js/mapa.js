let map;
let markerOrigen;
let markerDestino;

// Límite máximo permitido para la ruta en Kilómetros
const DISTANCIA_MAXIMA_KM = 50; 

// Coordenadas globales de Origen (Punto A)
let latOrigenGlobal = null;
let lngOrigenGlobal = null;

// Inicializar el mapa
function inicializarMapa(latCentro, lngCentro) {
  latOrigenGlobal = latCentro;
  lngOrigenGlobal = lngCentro;

  map = L.map('map', { zoomControl: false }).setView([latCentro, lngCentro], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Escuchar clics en el mapa para el Destino (Punto B)
  map.on('click', (e) => {
    const latDest = e.latlng.lat;
    const lngDest = e.latlng.lng;

    if (latOrigenGlobal && lngOrigenGlobal) {
      const distancia = calcularDistanciaHaversine(latOrigenGlobal, lngOrigenGlobal, latDest, lngDest);
      if (distancia > DISTANCIA_MAXIMA_KM) {
        alert(`El punto seleccionado está fuera del rango permitido (${distancia.toFixed(1)} km). El límite máximo es de ${DISTANCIA_MAXIMA_KM} km.`);
        return;
      }
    }

    if (typeof window.onMapaClickCallback === 'function') {
      window.onMapaClickCallback(latDest, lngDest);
    }
  });
}

// Centrar y mover mapa
function centrarMapa(lat, lng, zoom = 16) {
  if (map) map.setView([lat, lng], zoom);
}

// Colocar o actualizar marcador de Origen (Punto A)
function actualizarMarcadorOrigen(lat, lng) {
  latOrigenGlobal = lat;
  lngOrigenGlobal = lng;

  const iconOrigen = L.divIcon({
    className: 'custom-pin-origen',
    html: `<div class="w-5 h-5 bg-emerald-500 border-4 border-white rounded-full shadow-lg animate-pulse"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  if (markerOrigen) {
    markerOrigen.setLatLng([lat, lng]);
  } else {
    markerOrigen = L.marker([lat, lng], { icon: iconOrigen }).addTo(map);
  }
}

// Colocar o actualizar marcador de Destino (Punto B)
function actualizarMarcadorDestino(lat, lng) {
  const iconDestino = L.divIcon({
    className: 'custom-pin-destino',
    html: `<div class="w-5 h-5 bg-orange-500 border-4 border-white rounded-full shadow-lg animate-bounce"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  if (markerDestino) {
    markerDestino.setLatLng([lat, lng]);
  } else {
    markerDestino = L.marker([lat, lng], { icon: iconDestino }).addTo(map);
  }
}

/**
 * Buscador blindado con control fronterizo: 
 * Incluye &addressdetails=1 para validar que el país sea estrictamente Venezuela ('ve')
 * y descarta cualquier ciudad vecina como Cúcuta.
 */
async function buscarDestinosVenezuela(textoBusqueda) {
  if (!textoBusqueda || textoBusqueda.trim().length < 3) return [];

  try {
    // Añadimos &addressdetails=1 para obtener metadatos de país y región de cada sitio
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(textoBusqueda)}&countrycodes=ve&addressdetails=1&limit=25`;

    if (latOrigenGlobal && lngOrigenGlobal) {
      const delta = 0.4; 
      const minLng = lngOrigenGlobal - delta;
      const minLat = latOrigenGlobal - delta;
      const maxLng = lngOrigenGlobal + delta;
      const maxLat = latOrigenGlobal + delta;

      url += `&viewbox=${minLng},${maxLat},${maxLng},${minLat}&bounded=1`;
    }

    const response = await fetch(url);
    const sitios = await response.json();

    if (latOrigenGlobal && lngOrigenGlobal) {
      return sitios
        .map(sitio => {
          const dist = calcularDistanciaHaversine(
            latOrigenGlobal, 
            lngOrigenGlobal, 
            parseFloat(sitio.lat), 
            parseFloat(sitio.lon)
          );
          sitio.distancia_km = dist;
          return sitio;
        })
        .filter(sitio => {
          // Obtener el código de país que devuelve OpenStreetMap (ej: 've', 'co', etc.)
          const countryCode = sitio.address && sitio.address.country_code;
          
          // Filtro estricto: Debe pertenecer a Venezuela ('ve') Y estar dentro de los 50 km
          const esDeVenezuela = countryCode ? countryCode === 've' : true;
          return esDeVenezuela && sitio.distancia_km <= DISTANCIA_MAXIMA_KM;
        })
        // Ordenar del más cercano al más lejano
        .sort((a, b) => a.distancia_km - b.distancia_km);
    }

    return sitios;
  } catch (error) {
    console.error("Error al buscar sitios cercanos:", error);
    return [];
  }
}

/**
 * Fórmula matemática de Haversine para calcular distancia en kilómetros
 */
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
