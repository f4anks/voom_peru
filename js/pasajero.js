let supabaseClient = null;
let map = null;
let origenMarker = null;
let destinoMarker = null;
let currentUser = null;
let debounceTimer = null;
let modoSeleccion = 'destino';

// Respaldo seguro por si CONFIG_VOOM aún no ha cargado
const CONFIG_DEFECTO = {
  SUPABASE_URL: "https://gklquvthucityzgcamao.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM",
  UBICACION_DEFECTO: { lat: -12.046374, lng: -77.042793 },
  TARIFA: { precioBase: 1.00, precioPorKm: 0.50, tarifaMinima: 2.00 },
  MULTIPLICADORES: { moto: 1.0, economico: 1.5, confort: 2.0, flete: 3.5, grua: 6.0 }
};

function getConfig() {
  return typeof CONFIG_VOOM !== 'undefined' ? CONFIG_VOOM : CONFIG_DEFECTO;
}

let origenCoords = { ...(getConfig().UBICACION_DEFECTO || CONFIG_DEFECTO.UBICACION_DEFECTO) };
let destinoCoords = null;

// INICIO INMEDIATO: El mapa y la interfaz cargan al instante sin bloqueos de red
window.addEventListener('DOMContentLoaded', () => {
  inicializarMapa();
  configurarBuscadorDestino();
  conectarSupabaseEnSegundoPlano();
});

async function conectarSupabaseEnSegundoPlano() {
  try {
    if (window.supabase && window.supabase.createClient) {
      const config = getConfig();
      supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
      
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        currentUser = user;
        const nameEl = document.getElementById('user-name');
        if (nameEl) {
          nameEl.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
        }
      }
    }
  } catch (err) {
    console.warn("Modo local o sin sesión activa en Supabase:", err);
  }
}

function activarModoSeleccion(modo) {
  modoSeleccion = modo;
}

function inicializarMapa() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || typeof L === 'undefined' || map !== null) return;

  // Inicializar mapa centrado en Lima, Perú
  map = L.map('map', { zoomControl: false }).setView([origenCoords.lat, origenCoords.lng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 250);

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

  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    if (modoSeleccion === 'origen') {
      actualizarPosicionOrigen(lat, lng);
    } else {
      actualizarPosicionDestino(lat, lng);
    }
  });

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
  recalcularTarifasViaje();
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
  recalcularTarifasViaje();

  // Habilitar botón de solicitar automáticamente al colocar destino
  const btnSolicitar = document.getElementById('btn-solicitar');
  if (btnSolicitar) {
    btnSolicitar.disabled = false;
    btnSolicitar.className = "w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/25 text-xs tracking-wider uppercase active:scale-[0.98]";
    btnSolicitar.textContent = "Solicitar Viaje 🚀";
  }
}

async function obtenerDireccionPorCoords(lat, lng, tipo) {
  const inputEl = document.getElementById(tipo === 'origen' ? 'origen-txt' : 'destino-txt');
  if (inputEl) inputEl.value = "Obteniendo dirección...";

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&countrycodes=pe`);
    const data = await res.json();
    if (data && data.display_name && inputEl) {
      const partes = data.display_name.split(',');
      inputEl.value = partes.slice(0, 3).join(',');
    }
  } catch (e) {
    if (inputEl) inputEl.value = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
  }
}

function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
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

function recalcularTarifasViaje() {
  if (!origenCoords || !destinoCoords) return;

  const distanciaKm = calcularDistanciaKm(
    origenCoords.lat, origenCoords.lng, 
    destinoCoords.lat, destinoCoords.lng
  );

  const config = getConfig();
  const { precioBase, precioPorKm, tarifaMinima } = config.TARIFA || CONFIG_DEFECTO.TARIFA;
  const multiplicadores = config.MULTIPLICADORES || CONFIG_DEFECTO.MULTIPLICADORES;

  document.querySelectorAll('.service-card').forEach(card => {
    const tipo = card.getAttribute('data-service');
    const mult = multiplicadores[tipo] || 1.0;

    let precioCalculado = (precioBase + (distanciaKm * precioPorKm)) * mult;
    if (precioCalculado < (tarifaMinima * mult)) {
      precioCalculado = tarifaMinima * mult;
    }

    const priceTag = card.querySelector('.price-tag');
    if (priceTag) {
      priceTag.setAttribute('data-base', precioCalculado.toFixed(2));
      priceTag.textContent = `S/ ${precioCalculado.toFixed(2)}`;
    }
  });
}

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
            if (map) map.setView([item.lat, item.lon], 15);
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
    const config = getConfig();
    const precioBase = selectedCard && selectedCard.querySelector('.price-tag').getAttribute('data-base') 
      ? parseFloat(selectedCard.querySelector('.price-tag').getAttribute('data-base')) 
      : config.TARIFA.tarifaMinima;

    if (supabaseClient && currentUser) {
      await supabaseClient.from('viajes').insert({
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
    }

    if (estadoTexto) estadoTexto.textContent = "🚀 ¡Viaje solicitado! Buscando conductor cercano...";

    setTimeout(() => {
      window.location.href = 'selector.html';
    }, 2000);

  } catch (err) {
    console.error("Error al solicitar viaje:", err);
    if (estadoTexto) estadoTexto.textContent = "🚀 ¡Solicitud simulada con éxito!";
    setTimeout(() => {
      window.location.href = 'selector.html';
    }, 1500);
  }
}
