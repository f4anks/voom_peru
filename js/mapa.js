let map;
let markerOrigen;
let markerDestino;

// Inicializar el mapa
function inicializarMapa(latCentro, lngCentro) {
  map = L.map('map', { zoomControl: false }).setView([latCentro, lngCentro], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Escuchar clics en el mapa para el Destino (Punto B)
  map.on('click', (e) => {
    if (typeof window.onMapaClickCallback === 'function') {
      window.onMapaClickCallback(e.latlng.lat, e.latlng.lng);
    }
  });
}

// Centrar y mover mapa
function centrarMapa(lat, lng, zoom = 16) {
  if (map) map.setView([lat, lng], zoom);
}

// Colocar o actualizar marcador de Origen (Punto A)
function actualizarMarcadorOrigen(lat, lng) {
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
