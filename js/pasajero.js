// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://gklquvthucityzgcamao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM";

let supabaseClient = null;
let map = null;
let userMarker = null;
let currentUser = null;

// Ubicación de prueba fija en Lima, Perú
let userCoords = { lat: -12.046374, lng: -77.042793 };

// Función para esperar la carga del SDK de Supabase
function esperarSupabase(intentos = 15) {
  return new Promise((resolve, reject) => {
    const verificar = (restantes) => {
      if (window.supabase && window.supabase.createClient) {
        resolve(window.supabase);
      } else if (restantes > 0) {
        setTimeout(() => verificar(restantes - 1), 300);
      } else {
        reject(new Error("SDK Supabase no disponible"));
      }
    };
    verificar(intentos);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const supabaseLib = await esperarSupabase();
    supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
      window.location.href = 'index.html';
      return;
    }
    currentUser = user;

    const nameEl = document.getElementById('user-name');
    if (nameEl) {
      nameEl.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
    }

    // Inicializar mapa dinámico centrado en Lima
    inicializarMapa();

  } catch (err) {
    console.error("Error al iniciar pasajero:", err);
  }
});

function inicializarMapa() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || typeof L === 'undefined') return;

  // 1. Inicializar mapa Leaflet centrado en Lima, Perú
  map = L.map('map', { zoomControl: false }).setView([userCoords.lat, userCoords.lng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // 2. Redibujar mapa para evitar pantalla en blanco en contenedores flex
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 300);

  // 3. Colocar marcador inicial en Lima
  userMarker = L.marker([userCoords.lat, userCoords.lng])
    .addTo(map)
    .bindPopup("<b>Ubicación de prueba (Lima, Perú)</b>")
    .openPopup();
  
  const origenInput = document.getElementById('origen-txt');
  if (origenInput) {
    origenInput.value = "Lima, Perú (Ubicación de prueba)";
  }

  // Si en el futuro deseas activar GPS real del dispositivo, se descomenta este bloque:
  /*
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        actualizarPosicionMapa(userCoords.lat, userCoords.lng);
        if (origenInput) origenInput.value = "Tu ubicación actual";
      },
      (err) => {
        console.warn("GPS denegado o no disponible, usando respaldo en Lima:", err);
      },
      { timeout: 5000, enableHighAccuracy: true }
    );
  }
  */
}

function actualizarPosicionMapa(lat, lng) {
  if (!map) return;
  map.setView([lat, lng], 15);
  map.invalidateSize();

  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    userMarker = L.marker([lat, lng]).addTo(map).bindPopup("<b>Estás aquí</b>").openPopup();
  }
}

async function solicitarViaje() {
  const destinoInput = document.getElementById('destino-txt');
  const destino = destinoInput ? destinoInput.value.trim() : '';

  if (!destino) {
    alert("Por favor ingresa la dirección de destino.");
    if (destinoInput) destinoInput.focus();
    return;
  }

  const btnSolicitar = document.getElementById('btn-solicitar');
  const estadoBox = document.getElementById('estado-viaje-box');
  const estadoTexto = document.getElementById('estado-viaje-texto');

  if (btnSolicitar) btnSolicitar.disabled = true;
  if (estadoBox) estadoBox.classList.remove('hidden');

  try {
    // Obtener precio base según el servicio seleccionado en tarjetas
    const servicioActual = window.servicioSeleccionado || 'economico';
    const selectedCard = document.querySelector(`[data-service="${servicioActual}"]`);
    const precioBase = selectedCard ? parseFloat(selectedCard.querySelector('.price-tag').getAttribute('data-base')) : 5.00;

    const { error } = await supabaseClient
      .from('viajes')
      .insert({
        pasajero_id: currentUser.id,
        tipo_servicio: servicioActual,
        origen_lat: userCoords.lat,
        origen_lng: userCoords.lng,
        destino_direccion: destino,
        precio: precioBase,
        estado: 'buscando'
      });

    if (error) throw error;

    if (estadoTexto) estadoTexto.textContent = "🚀 ¡Viaje solicitado! Buscando conductor cercano...";

    setTimeout(() => {
      window.location.href = 'selector.html';
    }, 2000);

  } catch (err) {
    console.error("Error al solicitar viaje:", err);
    alert("No se pudo enviar la solicitud: " + err.message);
    if (btnSolicitar) btnSolicitar.disabled = false;
    if (estadoBox) estadoBox.classList.add('hidden');
  }
}

function logout() {
  if (supabaseClient) {
    supabaseClient.auth.signOut().then(() => {
      localStorage.clear();
      window.location.href = 'index.html';
    });
  }
}
