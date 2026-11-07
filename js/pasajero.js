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

  // Cargar capa de mapa elegante (CartoDB / OpenStreetMap)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // Agregar control de zoom abajo a la derecha para no obstruir el diseño
  L.control.zoom({ position: 'bottomright' }).addTo(map);
}

// 2. Obtener la Geolocalización del Dispositivo
function obtenerUbicacionUsuario() {
  const inputOrigen = document.getElementById('origen-txt');

  if (!navigator.geolocation) {
    if (inputOrigen) inputOrigen.value = "Geolocalización no soportada";
    return;
  }

  inputOrigen.value = "Obteniendo tu ubicación...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      coordsOrigen = { lat, lng };

      // Centrar mapa en la ubicación del usuario con zoom cercano
      map.setView([lat, lng], 16);

      // Crear icono personalizado para el Origen (Punto A)
      const iconOrigen = L.divIcon({
        className: 'custom-pin-origen',
        html: `<div class="w-5 h-5 bg-emerald-500 border-4 border-white rounded-full shadow-lg animate-pulse"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      // Si ya existía un marcador previo, actualizarlo; si no, crearlo
      if (markerOrigen) {
        markerOrigen.setLatLng([lat, lng]);
      } else {
        markerOrigen = L.marker([lat, lng], { icon: iconOrigen }).addTo(map);
      }

      // Convertir Latitud/Longitud a Dirección de texto (Geocoding inverso)
      await obtenerDireccionTexto(lat, lng);
    },
    (error) => {
      console.warn("Error obteniendo ubicación:", error);
      let msj = "No se pudo obtener la ubicación";
      if (error.code === error.PERMISSION_DENIED) {
        msj = "Permiso de ubicación denegado";
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

// 3. Transformar coordenadas en nombre de calle / ciudad (Nominatim API)
async function obtenerDireccionTexto(lat, lng) {
  const inputOrigen = document.getElementById('origen-txt');
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const data = await response.json();

    if (data && data.display_name) {
      // Extraer una dirección corta (calle, sector o barrio)
      const partes = data.display_name.split(',');
      const direccionCorta = partes.slice(0, 3).join(',').trim();
      inputOrigen.value = direccionCorta;
    } else {
      inputOrigen.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  } catch (err) {
    console.error("Error al geocodificar dirección:", err);
    inputOrigen.value = `Ubicación actual (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}
