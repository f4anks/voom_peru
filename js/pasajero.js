let map;
let markerOrigen;
let coordsOrigen = null;

// 1. Inicializar el Mapa al cargar la pantalla
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  obtenerUbicacionUsuario();
});

function initMap() {
  // Coordenadas por defecto (Centro) mientras obtiene la ubicación real
  map = L.map('map', { zoomControl: false }).setView([10.5000, -66.9167], 14);

  // Capa oficial de OpenStreetMap LIBRE Y GRATUITA (Sin marcas de agua ni API Keys)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // Agregar control de zoom abajo a la derecha para no obstruir la UI
  L.control.zoom({ position: 'bottomright' }).addTo(map);
}

// 2. Obtener la Geolocalización del Dispositivo
function obtenerUbicacionUsuario() {
  const inputOrigen = document.getElementById('origen-txt');

  if (!navigator.geolocation) {
    if (inputOrigen) inputOrigen.value = "Geolocalización no soportada";
    return;
  }

  if (inputOrigen) inputOrigen.value = "Obteniendo tu ubicación...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      coordsOrigen = { lat, lng };

      // Centrar mapa en la ubicación real con zoom cercano
      map.setView([lat, lng], 16);

      // Icono verde animado para el Origen (Punto A)
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

      // Convertir coordenadas a nombre de dirección en texto
      await obtenerDireccionTexto(lat, lng);
    },
    (error) => {
      console.warn("Error obteniendo ubicación:", error);
      let msj = "No se pudo obtener la ubicación";
      if (error.code === error.PERMISSION_DENIED) {
        msj = "Permiso de ubicación denegado (Revisa los permisos del navegador)";
      }
      if (inputOrigen) inputOrigen.value = msj;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// 3. Transformar coordenadas a dirección legible mediante BigDataCloud
async function obtenerDireccionTexto(lat, lng) {
  const inputOrigen = document.getElementById('origen-txt');
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data) {
      const sector = data.locality || data.city || data.principalSubdivision || "";
      const ciudad = data.countryName ? `, ${data.countryName}` : "";
      
      if (sector) {
        inputOrigen.value = `${sector}${ciudad}`;
      } else {
        inputOrigen.value = `Ubicación actual (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
    } else {
      inputOrigen.value = `Ubicación actual (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  } catch (err) {
    console.error("Error al obtener dirección:", err);
    inputOrigen.value = `Ubicación detectada (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}
