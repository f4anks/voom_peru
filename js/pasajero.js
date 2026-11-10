// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://gklquvthucityzgcamao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM";

let supabaseClient = null;
let map = null;
let origenMarker = null;
let destinoMarker = null;
let currentUser = null;
let debounceTimer = null;
let modoSeleccion = 'destino'; // 'origen' o 'destino'

// Ubicación por defecto de prueba (Lima, Perú)
let origenCoords = { lat: -12.046374, lng: -77.042793 };
let destinoCoords = null;

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

    inicializarMapa();
    configurarBuscadorDestino();

  } catch (err) {
    console.error("Error al iniciar pasajero:", err);
  }
});

function activarModoSeleccion(modo) {
  modoSeleccion = modo;
}

function inicializarMapa() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || typeof L === 'undefined') return;

  // 1. Crear mapa Leaflet
  map = L.map('map', { zoomControl: false }).setView([origenCoords.lat, origenCoords.lng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 300);

  // Marcador Origen A (Verde)
  const greenIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#10b981; width:18px; height:18px; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);'></div>",
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  origenMarker = L.marker([origenCoords.lat, origenCoords.lng], { draggable: true, icon: greenIcon })
    .addTo(map)
    .bindPopup("<b>Origen (A)</b><br>Haz clic o arrastra")
    .openPopup();

  obtenerDireccionPorCoords(origenCoords.lat, origenCoords.lng, 'origen');

  // EVENTO DE SELECCIÓN EN MAPA (ORIGEN O DESTINO)
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    if (modoSeleccion === 'origen') {
      actualizarPosicionOrigen(lat, lng);
    } else {
      actualizarPosicionDestino(lat, lng);
    }
  });

  // Arrastrar origen
  origenMarker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    actualizarPosicionOrigen(pos.lat, pos.lng);
  });
}

function actualizarPosicionOrigen(lat, lng) {
  origenCoords = { lat, lng };
  if (origenMarker) {
    origenMarker.setLatLng([lat, lng]);
  }
  obtenerDireccionPorCoords(lat, lng, 'origen');
}

function actualizarPosicionDestino(lat, lng) {
  destinoCoords = { lat, lng };

  const orangeIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#f97316; width:18px; height:18px; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);'></div>",
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  if (destinoMarker) {
    destinoMarker.setLatLng([lat, lng]);
  } else {
    destinoMarker = L.marker([lat, lng], { draggable: true, icon: orangeIcon })
      .addTo(map)
      .bindPopup("<b>Destino (B)</b>")
      .openPopup();

    destinoMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      actualizarPosicionDestino(pos.lat, pos.lng);
    });
  }

  obtenerDireccionPorCoords(lat, lng, 'destino');
}

// Convertir Coordenadas -> Dirección escrita
async function obtenerDireccionPorCoords(lat, lng, tipo) {
  const inputEl = document.getElementById(tipo === 'origen' ? 'origen-txt' : 'destino-txt');
  if (inputEl) inputEl.value = "Obteniendo dirección...";

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&countrycodes=pe`);
    const data = await res.json();
    if (data && data.display_name && inputEl) {
      const partes = data.display_name.split(',');
      const direccionCorta = partes.slice(0, 3).join(',');
      inputEl.value = direccionCorta;
    }
  } catch (e) {
    if (inputEl) inputEl.value = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
  }
}

// Autocompletado de Destino
function configurarBuscadorDestino() {
  const destinoInput = document.getElementById('destino-txt');
  const sugerenciasBox = document.getElementById('sugerencias-destino');

  if (!destinoInput || !sugerenciasBox) return;

  destinoInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 3) {
      sugerenciasBox.classList.add('hidden');
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=pe&limit=5`;
        const res = await fetch(url);
        const resultados = await res.json();

        sugerenciasBox.innerHTML = '';
        if (resultados.length === 0) {
          sugerenciasBox.classList.add('hidden');
          return;
        }

        resultados.forEach(item => {
          const div = document.createElement('div');
          div.className = "p-3 hover:bg-orange-50 cursor-pointer border-b border-slate-100 text-xs font-semibold text-slate-700 flex items-center space-x-2";
          div.innerHTML = `<span>📍</span> <span>${item.display_name}</span>`;
          div.onclick = () => {
            destinoInput.value = item.display_name.split(',').slice(0, 3).join(',');
            actualizarPosicionDestino(parseFloat(item.lat), parseFloat(item.lon));
            map.setView([item.lat, item.lon], 15);
            sugerenciasBox.classList.add('hidden');
          };
          sugerenciasBox.appendChild(div);
        });

        sugerenciasBox.classList.remove('hidden');
      } catch (err) {
        console.error("Error al buscar dirección:", err);
      }
    }, 400);
  });
}

async function solicitarViaje() {
  const destinoInput = document.getElementById('destino-txt');
  const destino = destinoInput ? destinoInput.value.trim() : '';

  if (!destino) {
    alert("Por favor ingresa o marca en el mapa el punto de destino.");
    if (destinoInput) destinoInput.focus();
    return;
  }

  const btnSolicitar = document.getElementById('btn-solicitar');
  const estadoBox = document.getElementById('estado-viaje-box');
  const estadoTexto = document.getElementById('estado-viaje-texto');

  if (btnSolicitar) btnSolicitar.disabled = true;
  if (estadoBox) estadoBox.classList.remove('hidden');

  try {
    const servicioActual = window.servicioSeleccionado || 'economico';
    const selectedCard = document.querySelector(`[data-service="${servicioActual}"]`);
    const precioBase = selectedCard ? parseFloat(selectedCard.querySelector('.price-tag').getAttribute('data-base')) : 5.00;

    const { error } = await supabaseClient
      .from('viajes')
      .insert({
        pasajero_id: currentUser.id,
        tipo_servicio: servicioActual,
        origen_lat: origenCoords.lat,
        origen_lng: origenCoords.lng,
        destino_direccion: destino,
        destino_lat: destinoCoords ? destinoCoords.lat : null,
        destino_lng: destinoCoords ? destinoCoords.lng : null,
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
    alert("No se pudo enviar la solicitud: " + error.message);
    if (btnSolicitar) btnSolicitar.disabled = false;
    if (estadoBox) estadoBox.classList.add('hidden');
  }
}
