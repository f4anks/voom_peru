// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://gklquvthucityzgcamao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM";

let supabaseClient = null;
let map = null;
let passengerMarker = null;
let userPasajero = null;
let viajeActualId = null;

window.addEventListener('DOMContentLoaded', async () => {
  // Inicializar cliente Supabase evitando colisión con el SDK global
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("SDK de Supabase no cargado.");
    return;
  }

  // Validar sesión activa
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  userPasajero = user;

  // Consultar perfil del pasajero
  const { data: perfil } = await supabaseClient
    .from('perfiles')
    .select('nombre_completo')
    .eq('id', user.id)
    .single();

  const nombreDisplay = perfil?.nombre_completo || user.user_metadata?.nombre_completo || user.email;
  const elName = document.getElementById('user-name');
  if (elName) elName.innerText = nombreDisplay;

  // Inicializar mapa interactivo Leaflet
  map = L.map('map').setView([10.4806, -66.9036], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      map.setView([lat, lng], 15);
      passengerMarker = L.marker([lat, lng]).addTo(map).bindPopup("<b>Tu Ubicación</b>").openPopup();
      
      const origenTxt = document.getElementById('origen-txt');
      if (origenTxt) origenTxt.value = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }, () => {
      const origenTxt = document.getElementById('origen-txt');
      if (origenTxt) origenTxt.value = "Ubicación predeterminada (GPS inactivo)";
    });
  }
});

async function solicitarViaje() {
  const destinoInput = document.getElementById('destino-txt');
  const destino = destinoInput ? destinoInput.value.trim() : '';

  if (!destino) {
    alert("Por favor ingresa un destino válido.");
    return;
  }

  const btnSolicitar = document.getElementById('btn-solicitar');
  if (btnSolicitar) btnSolicitar.disabled = true;

  actualizarEstadoPasajero("Buscando un conductor cercano...");

  // Insertar solicitud en la tabla de viajes
  const { data, error } = await supabaseClient
    .from('viajes')
    .insert([
      {
        pasajero_id: userPasajero.id,
        destino_direccion: destino,
        precio: (Math.random() * 5 + 5).toFixed(2), // Tarifa estimada de prueba
        estado: 'buscando'
      }
    ])
    .select()
    .single();

  if (error) {
    alert("Error al solicitar el viaje: " + error.message);
    if (btnSolicitar) btnSolicitar.disabled = false;
    ocultarEstadoPasajero();
    return;
  }

  viajeActualId = data.id;
  escucharEstadoViaje(viajeActualId);
}

function actualizarEstadoPasajero(textoEstado) {
  const box = document.getElementById('estado-viaje-box');
  const texto = document.getElementById('estado-viaje-texto');
  
  if (box && texto) {
    box.classList.remove('hidden');
    texto.innerHTML = `
      <div class="flex items-center justify-center space-x-2">
        <div class="w-2 h-2 bg-orange-500 rounded-full animate-ping"></div>
        <span>${textoEstado}</span>
      </div>
    `;
  }
}

function ocultarEstadoPasajero() {
  const box = document.getElementById('estado-viaje-box');
  if (box) box.classList.add('hidden');
}

function escucharEstadoViaje(idViaje) {
  supabaseClient
    .channel(`viaje-${idViaje}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'viajes', filter: `id=eq.${idViaje}` },
      (payload) => {
        const viajeActualizado = payload.new;
        if (viajeActualizado.estado === 'aceptado') {
          actualizarEstadoPasajero("🎉 ¡Conductor asignado! En camino a recogerte.");
          alert("¡Un conductor ha aceptado tu viaje!");
        }
      }
    )
    .subscribe();
}

async function logout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  window.location.href = 'index.html';
}
