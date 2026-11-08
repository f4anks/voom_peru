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
 * Buscador blindado de alta precisión:
 * Forzado geográfico para Venezuela + Filtro de 50 km + Exclusión de homónimos internacionales.
 */
async function buscarDestinosVenezuela(textoBusqueda) {
  if (!textoBusqueda || textoBusqueda.trim().length < 3) return [];

  try {
    // Parámetros base: addressdetails=1 y countrycodes=ve
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(textoBusqueda)}&countrycodes=ve&addressdetails=1&limit=40`;

    // Si el origen está listo, cerramos el cuadro visual alrededor del usuario (~50km)
    if (latOrigenGlobal && lngOrigenGlobal) {
      const delta = 0.45;
      const minLng = lngOrigenGlobal - delta;
      const minLat = latOrigenGlobal - delta;
      const maxLng = lngOrigenGlobal + delta;
      const maxLat = latOrigenGlobal + delta;

      url += `&viewbox=${minLng},${maxLat},${maxLng},${minLat}&bounded=1`;
    } else {
      // Coordenadas caja límite general de toda Venezuela por si el GPS del origen no ha cargado aún
      url += `&viewbox=-73.35,12.2,-59.8,0.66&bounded=1`;
    }

    const response = await fetch(url);
    const sitios = await response.json();

    return sitios
      .map(sitio => {
        if (latOrigenGlobal && lngOrigenGlobal) {
          sitio.distancia_km = calcularDistanciaHaversine(
            latOrigenGlobal, 
            lngOrigenGlobal, 
            parseFloat(sitio.lat), 
            parseFloat(sitio.lon)
          );
        } else {
          sitio.distancia_km = 0;
        }
        return sitio;
      })
      .filter(sitio => {
        const address = sitio.address || {};
        const countryCode = (address.country_code || '').toLowerCase();
        const countryName = (address.country || '').toLowerCase();
        const displayName = (sitio.display_name || '').toLowerCase();

        // 1. RECHAZO ABSOLUTO: Si la respuesta no pertenece a Venezuela
        if (countryCode && countryCode !== 've') return false;
        if (countryName && !countryName.includes('venezuela') && countryName.length > 0) return false;

        // 2. FILTRO PALABRAS CLAVE EXTRANJERAS
        const paisesBloqueados = ['brasil', 'brazil', 'italy', 'italia', 'rumania', 'romania', 'colombia', 'peru', 'ecuador', 'verona'];
        const esExtranjero = paisesBloqueados.some(p => displayName.includes(p));
        if (esExtranjero && !displayName.includes('venezuela')) return false;

        // 3. FILTRO DISTANCIA 50 KM (Si el origen está activo)
        if (latOrigenGlobal && lngOrigenGlobal && sitio.distancia_km > DISTANCIA_MAXIMA_KM) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.distancia_km - b.distancia_km);
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
