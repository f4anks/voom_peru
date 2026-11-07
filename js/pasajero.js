let map;
let markerOrigen;
let markerDestino;
let coordsOrigen = null;
let coordsDestino = null;

// Configuración de Tarifas de Voom
const CONFIG_TARIFA = {
  precioBase: 1.00,      // Bajada de bandera
  precioPorKm: 0.60,     // Valor del kilómetro recorrible
  tarifaMinima: 2.00     // Monto mínimo por viaje
};

// 1. Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  cargarNombreUsuario();
  initMap();
  obtenerUbicacionUsuario();
});

// Cargar Nombre del Usuario con lectura prioritaria
async function cargarNombreUsuario() {
  const userNameEl = document.getElementById('user-name');
  if (!userNameEl) return;

  // Paso A: Leer de inmediato el localStorage
  const nombreLocal = localStorage.getItem('voom_user_name');
  if (nombreLocal && nombreLocal.trim() !== '') {
    userNameEl.textContent = nombreLocal;
    return;
  }

  // Paso B: Consultar sesión activa de Supabase como fallback
  try {
    if (typeof supabaseClient !== 'undefined') {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        const nombre = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        const nombreFormateado = nombre.charAt(0).toUpperCase() + nombre.slice(1);
        
        userNameEl.textContent = nombreFormateado;
        localStorage.setItem('voom_user_name', nombreFormateado);
        return;
      }
    }
  } catch (err) {
    console.error("Error consultando sesión:", err);
  }

  // Paso C: Si no hay datos guardados
  userNameEl.textContent = "Pasajero";
}

// Inicializar Mapa sin Marcas de Agua (OpenStreetMap Puro)
function initMap() {
  map = L.map('map', { zoomControl: false }).setView([10.5000, -66.9167], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Seleccionar destino al hacer clic en el mapa
  map.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    coordsDestino = { lat, lng };

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

    await obtenerTextoDestino(lat, lng);
    calcularTarifaViaje();
  });
}

// 2. Obtener Geolocalización actual
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
      console.warn("Error obteniendo ubicación:", error);
      let msj = "No se pudo obtener la ubicación";
      if (error.code === error.PERMISSION_DENIED) {
        msj = "Permiso de GPS denegado";
      }
      if (inputOrigen) inputOrigen.value = msj;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Transformar Origen a Texto usando BigDataCloud
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

// Transformar Destino a Texto
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

// 3. Cálculo de Distancia y Tarifa Dinámica por Kilómetro
async function calcularTarifaViaje() {
  if (!coordsOrigen || !coordsDestino) return;

  const precioBox = document.getElementById('precio-box');
  const distanciaTxt = document.getElementById('distancia-texto');
  const precioMonto = document.getElementById('precio-monto');

  try {
    const urlRoute = `https://router.project-osrm.org/route/v1/driving/${coordsOrigen.lng},${coordsOrigen.lat};${coordsDestino.lng},${coordsDestino.lat}?overview=false`;
    const response = await fetch(urlRoute);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const metros = data.routes[0].distance;
      const kilometros = (metros / 1000).toFixed(2);

      let precioFinal = CONFIG_TARIFA.precioBase + (kilometros * CONFIG_TARIFA.precioPorKm);
      if (precioFinal < CONFIG_TARIFA.tarifaMinima) {
        precioFinal = CONFIG_TARIFA.tarifaMinima;
      }

      if (distanciaTxt) distanciaTxt.textContent = `${kilometros} km de recorrido`;
      if (precioMonto) precioMonto.textContent = `$${precioFinal.toFixed(2)}`;
      if (precioBox) precioBox.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Error al calcular la ruta:", err);
  }
}
