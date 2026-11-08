let map;
let markerOrigen;
let markerDestino;
let markerConductor = null;

// Límite máximo permitido para la ruta en Kilómetros
const DISTANCIA_MAXIMA_KM = 50; 

// Coordenadas globales de Origen (Punto A)
let latOrigenGlobal = null;
let lngOrigenGlobal = null;

// Inicializar el mapa centrado en Lima, Perú por defecto (Sin API Key, 100% libre)
function inicializarMapaPeru(latCentro = -12.0464, lngCentro = -77.0428) {
  latOrigenGlobal = latCentro;
  lngOrigenGlobal = lngCentro;

  map = L.map('map', { zoomControl: false }).setView([latCentro, lngCentro], 14);

  // Usar OpenStreetMap estándar limpio (sin restricciones de API key)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
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

// Colocar o actualizar marcador de Origen (Punto A - Pasajero)
function actualizarMarcadorOrigen(lat, lng) {
  latOrigenGlobal = lat;
  lngOrigenGlobal = lng;

  const iconOrigen = L.divIcon({
    className: 'custom-pin-origen',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 bg-emerald-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center text-white font-black text-xs animate-pulse">
          📍
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
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
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 bg-orange-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center text-white font-black text-xs animate-bounce">
          🏁
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  if (markerDestino) {
    markerDestino.setLatLng([lat, lng]);
  } else {
    markerDestino = L.marker([lat, lng], { icon: iconDestino }).addTo(map);
  }
}

// Colocar o actualizar marcador del Conductor (Vehículo en movimiento)
function actualizarMarcadorConductor(lat, lng) {
  const iconConductor = L.divIcon({
    className: 'custom-pin-conductor',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-10 h-10 bg-slate-900 border-4 border-orange-500 rounded-2xl shadow-xl flex items-center justify-center text-white text-base">
          🚗
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  if (markerConductor) {
    markerConductor.setLatLng([lat, lng]);
  } else {
    markerConductor = L.marker([lat, lng], { icon: iconConductor }).addTo(map).bindPopup("<b>Conductor en camino</b>");
  }
}

/**
 * Buscador blindado de alta precisión para PERÚ:
 * Forzado geográfico para Perú (countrycodes=pe) + Filtro de 50 km + Exclusión de homónimos internacionales.
 */
async function buscarDestinosPeru(textoBusqueda) {
  if (!textoBusqueda || textoBusqueda.trim().length < 3) return [];

  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(textoBusqueda)}&countrycodes=pe&addressdetails=1&limit=40`;

    if (latOrigenGlobal && lngOrigenGlobal) {
      const delta = 0.45;
      const minLng = lngOrigenGlobal - delta;
      const minLat = latOrigenGlobal - delta;
      const maxLng = lngOrigenGlobal + delta;
      const maxLat = latOrigenGlobal + delta;

      url += `&viewbox=${minLng},${maxLat},${maxLng},${minLat}&bounded=1`;
    } else {
      url += `&viewbox=-81.33,-0.04,-68.65,-18.35&bounded=1`;
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

        if (countryCode && countryCode !== 'pe') return false;
        if (countryName && !countryName.includes('perú') && !countryName.includes('peru') && countryName.length > 0) return false;

        const paisesBloqueados = ['venezuela', 'brasil', 'brazil', 'italy', 'italia', 'rumania', 'romania', 'colombia', 'ecuador', 'españa'];
        const esExtranjero = paisesBloqueados.some(p => displayName.includes(p));
        if (esExtranjero && !displayName.includes('perú') && !displayName.includes('peru')) return false;

        if (latOrigenGlobal && lngOrigenGlobal && sitio.distancia_km > DISTANCIA_MAXIMA_KM) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.distancia_km - b.distancia_km);
  } catch (error) {
    console.error("Error al buscar sitios cercanos en Perú:", error);
    return [];
  }
}

function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
