let map;
let markerOrigen;
let markerDestino;

// Límite máximo permitido para la ruta en Kilómetros (Ajustable)
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

    // Validar si el punto seleccionado en el mapa excede los kilómetros límite
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
 * Función para buscar sitios restringidos a VENEZUELA (countrycodes=ve) por ahora.
 * Filtra los resultados para que no superen la distancia límite establecida.
 */
async function buscarDestinosVenezuela(textoBusqueda) {
  if (!textoBusqueda || textoBusqueda.trim().length < 3) return [];

  try {
    // Parámetro 'countrycodes=ve' para acotar la búsqueda dentro de Venezuela
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(textoBusqueda)}&countrycodes=ve&limit=10`;
    const response = await fetch(url);
    const sitios = await response.json();

    // Filtrar sitios que respeten el límite de kilómetros si el origen está cargado
    if (latOrigenGlobal && lngOrigenGlobal) {
      return sitios.filter(sitio => {
        const dist = calcularDistanciaHaversine(
          latOrigenGlobal, 
          lngOrigenGlobal, 
          parseFloat(sitio.lat), 
          parseFloat(sitio.lon)
        );
        sitio.distancia_km = dist;
        return dist <= DISTANCIA_MAXIMA_KM;
      });
    }

    return sitios;
  } catch (error) {
    console.error("Error al buscar sitios en Venezuela:", error);
    return [];
  }
}

/**
 * Fórmula matemática de Haversine para calcular distancia real en kilómetros
 */
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
