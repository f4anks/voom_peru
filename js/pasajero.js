let map;
let markerOrigen;
let markerDestino;
let routingControl;
let coordsOrigen = null;
let coordsDestino = null;

// Configuración de Tarifas de Voom
const CONFIG_TARIFA = {
  precioBase: 1.00,      // Bajada de bandera / Tarifa inicial
  precioPorKm: 0.60,     // Precio por kilómetro
  tarifaMinima: 2.00     // Monto mínimo a cobrar por viaje
};

document.addEventListener('DOMContentLoaded', () => {
  cargarNombreUsuario();
  initMap();
  obtenerUbicacionUsuario();
});

async function cargarNombreUsuario() {
  const userNameEl = document.getElementById('user-name');
  if (!userNameEl) return;

  try {
    if (typeof supabaseClient !== 'undefined') {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        const userMetadata = session.user.user_metadata;
        if (userMetadata && userMetadata.full_name) {
          userNameEl.textContent = userMetadata.full_name;
          return;
        } else if (session.user.email) {
          const nombreCorreo = session.user.email.split('@')[0];
          userNameEl.textContent = nombreCorreo.charAt(0).toUpperCase() + nombreCorreo.slice(1);
          return;
        }
      }
    }
    const nombreLocal = localStorage.getItem('voom_user_name');
    userNameEl.textContent = nombreLocal || "Pasajero";
  } catch (err) {
    userNameEl.textContent = "Pasajero";
  }
}

function initMap() {
  map = L.map('map', { zoomControl: false }).setView([10.5000, -66.9167], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Permitir seleccionar destino haciendo clic directamente sobre el mapa
  map.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    coordsDestino = { lat, lng };

    // Actualizar icono de destino en el mapa
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

    // Geocodificar texto de destino
    await obtenerTextoDestino(lat, lng);
    calcularTarifaViaje();
  });
}

// Obtener ubicación GPS actual del usuario
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

      map.setView([lat, lng], 16);

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

      await obtenerDireccionTexto(lat, lng);
    },
    (error) => {
      let msj = "No se pudo obtener la ubicación";
      if (error.code === error.PERMISSION_DENIED) {
        msj = "Permiso denegado (Activa el GPS)";
      }
      if (inputOrigen) inputOrigen.value = msj;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Convertir coords de Origen a Texto
async function obtenerDireccionTexto(lat, lng) {
  const inputOrigen = document.getElementById('origen-txt');
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.locality) {
      inputOrigen.value = `${data.locality}${data.countryName ? ', ' + data.countryName : ''}`;
    } else {
      inputOrigen.value = `Ubicación actual (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  } catch (err) {
    inputOrigen.value = `Ubicación detectada (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}

// Convertir coords de Destino a Texto
async function obtenerTextoDestino(lat, lng) {
  const inputDestino = document.getElementById('destino-txt');
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.locality) {
      inputDestino.value = `${data.locality}`;
    } else {
      inputDestino.value = `Punto seleccionado (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  } catch (err) {
    inputDestino.value = `Punto seleccionado`;
  }
}

// CALCULAR RUTA, DISTANCIA Y PRECIO ESTIMADO
async function calcularTarifaViaje() {
  if (!coordsOrigen || !coordsDestino) return;

  const precioBox = document.getElementById('precio-box');
  const distanciaTxt = document.getElementById('distancia-texto');
  const precioMonto = document.getElementById('precio-monto');

  try {
    // Consulta a la API de rutas OSRM para obtener la distancia real por calle
    const urlRoute = `https://router.project-osrm.org/route/v1/driving/${coordsOrigen.lng},${coordsOrigen.lat};${coordsDestino.lng},${coordsDestino.lat}?overview=false`;
    const response = await fetch(urlRoute);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const metros = data.routes[0].distance;
      const kilometros = (metros / 1000).toFixed(2);

      // Aplicar fórmula de cálculo de precio
      let precioFinal = CONFIG_TARIFA.precioBase + (kilometros * CONFIG_TARIFA.precioPorKm);
      if (precioFinal < CONFIG_TARIFA.tarifaMinima) {
        precioFinal = CONFIG_TARIFA.tarifaMinima;
      }

      // Mostrar en la interfaz
      if (distanciaTxt) distanciaTxt.textContent = `${kilometros} km de recorrido`;
      if (precioMonto) precioMonto.textContent = `$${precioFinal.toFixed(2)}`;
      if (precioBox) precioBox.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Error al calcular ruta:", err);
  }
}
