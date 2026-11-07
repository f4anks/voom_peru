// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://gklquvthucityzgcamao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM";

let supabaseClient = null;
let map = null;
let conductorMarker = null;
let userConductor = null;

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

  userConductor = user;

  // Consultar comunicados de la administración para el conductor
  verificarAnunciosGlobales();

  // Consultar perfil completo del conductor (nombre, cédula, estado y vehículo)
  const { data: perfil, error } = await supabaseClient
    .from('perfiles')
    .select('estado_cuenta, cedula, vehiculo_placa, nombre_completo')
    .eq('id', user.id)
    .single();

  if (error || !perfil) {
    console.error("Error al obtener perfil del conductor:", error);
    return;
  }

  // Mostrar el nombre y la cédula en la parte superior del header
  const nombreDisplay = perfil.nombre_completo || user.user_metadata?.nombre_completo || user.email;
  const cedulaDisplay = perfil.cedula ? `C.I: ${perfil.cedula}` : 'Sin cédula registrada';
  
  const elName = document.getElementById('user-name');
  const elCedula = document.getElementById('user-cedula');
  
  if (elName) elName.innerText = nombreDisplay;
  if (elCedula) elCedula.innerText = cedulaDisplay;

  // Validar estado de la cuenta del conductor
  if (perfil.estado_cuenta !== 'aprobado') {
    mostrarPantallaBloqueo(perfil.estado_cuenta);
    return;
  }

  // Inicializar mapa interactivo Leaflet si la cuenta está APROBADA
  map = L.map('map').setView([10.4806, -66.9036], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      map.setView([lat, lng], 15);
      conductorMarker = L.marker([lat, lng]).addTo(map).bindPopup("<b>Tu Vehículo</b>").openPopup();
    });
  }

  cargarViajesPendientes();
  escucharNuevosViajes();
});

function mostrarPantallaBloqueo(estado) {
  const contenedor = document.getElementById('lista-viajes');
  if (!contenedor) return;
  
  const esPendiente = estado === 'pendiente';
  
  contenedor.innerHTML = `
    <div class="text-center py-6 px-4 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xs">
      <div class="inline-flex items-center justify-center w-12 h-12 bg-orange-50 border border-orange-200 text-orange-600 rounded-2xl mb-3 shadow-xs animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-xs font-black text-slate-900 uppercase tracking-wider">
        ${esPendiente ? 'Validación en Proceso' : 'Solicitud No Aprobada'}
      </h3>
      <p class="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
        ${esPendiente 
          ? 'Tus documentos e información vehicular están siendo verificados por seguridad. Tu acceso se activará en breve.' 
          : 'Lamentablemente tu perfil no cumple con los estándares requeridos.'}
      </p>
      <div class="mt-3 inline-flex items-center space-x-1.5 text-[10px] bg-orange-100 text-orange-700 font-extrabold px-3 py-1 rounded-full border border-orange-200">
        <span class="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span>
        <span>Sistemas seguros activos</span>
      </div>
    </div>
  `;
}

async function cargarViajesPendientes() {
  const { data: viajes, error } = await supabaseClient
    .from('viajes')
    .select('*, perfiles(nombre_completo)')
    .eq('estado', 'buscando');

  if (error) {
    console.error("Error cargando viajes:", error);
    return;
  }

  renderizarViajes(viajes);
}

function renderizarViajes(viajes) {
  const contenedor = document.getElementById('lista-viajes');
  if (!contenedor) return;
  
  contenedor.innerHTML = '';

  if (!viajes || viajes.length === 0) {
    contenedor.innerHTML = '<p class="text-xs text-slate-400 text-center py-4 font-semibold">Esperando nuevas solicitudes de pasajeros...</p>';
    return;
  }

  viajes.forEach(v => {
    const item = document.createElement('div');
    item.className = "bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex justify-between items-center shadow-xs transition-all hover:border-orange-300";
    item.innerHTML = `
      <div>
        <p class="text-xs font-extrabold text-slate-900">Destino: ${v.destino_direccion}</p>
        <p class="text-xs font-extrabold text-orange-600 mt-0.5">Tarifa: $${v.precio}</p>
      </div>
      <button onclick="aceptarViaje('${v.id}')" class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-orange-500/25 active:scale-[0.98]">
        Aceptar
      </button>
    `;
    contenedor.appendChild(item);
  });
}

function escucharNuevosViajes() {
  supabaseClient
    .channel('viajes-disponibles')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'viajes' },
      () => {
        cargarViajesPendientes();
      }
    )
    .subscribe();
}

async function aceptarViaje(idViaje) {
  const { error } = await supabaseClient
    .from('viajes')
    .update({
      conductor_id: userConductor.id,
      estado: 'aceptado'
    })
    .eq('id', idViaje);

  if (error) {
    alert("No se pudo aceptar el viaje: " + error.message);
    return;
  }

  alert("🚀 ¡Viaje Aceptado! Dirígete a buscar al pasajero.");
  cargarViajesPendientes();
}

async function logout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  window.location.href = 'index.html';
}

// Verificación de Anuncios Globales desde Supabase para Conductores
async function verificarAnunciosGlobales() {
  try {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
      .from('anuncios')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return;

    const ultimoAnuncio = data[0];
    const ultimoVistoId = localStorage.getItem('voom_ultimo_anuncio_id_conductor');

    if (String(ultimoVistoId) !== String(ultimoAnuncio.id)) {
      const modal = document.getElementById('modal-anuncio');
      const tituloEl = document.getElementById('anuncio-modal-titulo');
      const mensajeEl = document.getElementById('anuncio-modal-mensaje');

      if (modal && tituloEl && mensajeEl) {
        tituloEl.textContent = ultimoAnuncio.titulo || "Comunicado Oficial";
        mensajeEl.textContent = ultimoAnuncio.mensaje || "";
        
        modal.classList.remove('hidden');
        localStorage.setItem('voom_ultimo_anuncio_id_conductor', ultimoAnuncio.id);
      }
    }
  } catch (err) {
    console.error("Error al obtener anuncios globales para conductor:", err);
  }
}

function cerrarModalAnuncio() {
  const modal = document.getElementById('modal-anuncio');
  if (modal) modal.classList.add('hidden');
}
