// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://gklquvthucityzgcamao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM";

let supabaseClient = null;
let map = null;
let conductorMarker = null;
let userConductor = null;
let perfilConductor = null;

window.addEventListener('DOMContentLoaded', async () => {
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("SDK de Supabase no cargado.");
    return;
  }

  // Validar sesión activa
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    window.location.href = 'index.html';
    return;
  }

  userConductor = user;
  verificarAnunciosGlobales();

  // Consultar perfil del conductor en Supabase
  const { data: perfil, error } = await supabaseClient
    .from('perfiles')
    .select('estado_cuenta, vehiculo_placa, vehiculo_matricula, nombre_completo, tipo_servicio')
    .eq('id', user.id)
    .maybeSingle();

  // Validar si completó el formulario de datos del vehículo
  const tieneVehiculo = perfil && (perfil.vehiculo_placa || perfil.vehiculo_matricula);

  // Si no existe perfil o no ha subido los datos del vehículo/servicio, se envía al registro de conductor
  if (error || !perfil || !tieneVehiculo) {
    window.location.href = 'registro_cond.html';
    return;
  }

  perfilConductor = perfil;

  const nombreDisplay = perfil.nombre_completo || user.user_metadata?.full_name || user.email.split('@')[0];
  const elGreeting = document.getElementById('conductor-greeting');
  if (elGreeting) {
    elGreeting.textContent = `Hola, ${nombreDisplay}`;
  }

  // VALIDACIÓN ESTRICTA DE ESTADO:
  // Si NO está aprobado, bloqueamos el panel y mostramos el mensaje de espera de revisión del admin.
  if (perfil.estado_cuenta !== 'aprobado') {
    mostrarPantallaEsperaAprobacion(perfil.estado_cuenta);
    return;
  }

  // --- SOLO SI EL ADMIN YA APROBÓ, SE MUESTRA EL PANEL COMPLETO Y EL MAPA ---
  const statusPanel = document.getElementById('status-panel');
  if (statusPanel) {
    statusPanel.textContent = `¡Cuenta Aprobada! Conéctate para recibir solicitudes (${(perfil.tipo_servicio || 'Servicio').toUpperCase()}).`;
    statusPanel.className = "p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold text-center";
  }

  const mapContainer = document.getElementById('map');
  if (mapContainer) {
    map = L.map('map').setView([-12.046374, -77.042793], 13); // Coordenadas por defecto (Perú)
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
  }

  cargarViajesPendientes();
  escucharNuevosViajes();
});

// Pantalla de bloqueo obligatoria mientras el Admin no apruebe
function mostrarPantallaEsperaAprobacion(estado) {
  const statusPanel = document.getElementById('status-panel');
  if (!statusPanel) return;
  
  const esSuspendido = estado === 'suspendido';

  statusPanel.className = "p-6 rounded-2xl bg-orange-50 border border-orange-200 text-center space-y-3 shadow-sm";
  statusPanel.innerHTML = `
    <div class="inline-flex items-center justify-center w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl shadow-xs animate-pulse mx-auto">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <h3 class="text-xs font-black text-slate-900 uppercase tracking-wider">
      ${esSuspendido ? 'Cuenta Suspendida' : 'Esperando Aprobación del Administrador'}
    </h3>
    <p class="text-xs text-slate-600 leading-relaxed font-medium">
      ${esSuspendido 
        ? 'Tu cuenta se encuentra suspendida por la administración.' 
        : 'Tus documentos han sido enviados con éxito. Un administrador debe revisar y aprobar tu perfil desde el panel de control antes de que puedas conectarte para recibir carreras.'}
    </p>
    <div class="inline-flex items-center space-x-1.5 text-[10px] bg-orange-100 text-orange-700 font-extrabold px-3 py-1 rounded-full border border-orange-200">
      <span class="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span>
      <span>Pendiente de revisión administrativa</span>
    </div>
  `;

  // Ocultar elementos de conexión si existen
  const toggleContainer = document.getElementById('toggle-container');
  if (toggleContainer) toggleContainer.innerHTML = '';
}

// Carga únicamente viajes filtrados por el tipo_servicio del conductor
async function cargarViajesPendientes() {
  if (!perfilConductor || !perfilConductor.tipo_servicio) return;

  const { data: viajes, error } = await supabaseClient
    .from('viajes')
    .select('*, perfiles(nombre_completo)')
    .eq('estado', 'buscando')
    .eq('tipo_servicio', perfilConductor.tipo_servicio);

  if (error) return;
  renderizarViajes(viajes);
}

function renderizarViajes(viajes) {
  const contenedor = document.getElementById('lista-viajes');
  if (!contenedor) return;
  contenedor.innerHTML = '';

  if (!viajes || viajes.length === 0) {
    const servicioNombre = (perfilConductor?.tipo_servicio || 'servicio').toUpperCase();
    contenedor.innerHTML = `<p class="text-xs text-slate-400 text-center py-4 font-semibold">Esperando nuevas solicitudes de tipo <span class="text-orange-600 font-black">${servicioNombre}</span>...</p>`;
    return;
  }

  viajes.forEach(v => {
    const item = document.createElement('div');
    item.className = "bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex justify-between items-center shadow-xs transition-all hover:border-orange-300";
    item.innerHTML = `
      <div>
        <div class="flex items-center space-x-2">
          <span class="text-[10px] font-black uppercase bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">${v.tipo_servicio || 'viaje'}</span>
          <p class="text-xs font-extrabold text-slate-900">Destino: ${v.destino_direccion}</p>
        </div>
        <p class="text-xs font-extrabold text-orange-600 mt-1">Tarifa: S/ ${v.precio}</p>
      </div>
      <button onclick="aceptarViaje('${v.id}')" class="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md active:scale-95 transition-transform">
        Aceptar
      </button>
    `;
    contenedor.appendChild(item);
  });
}

// Escuchar únicamente viajes de la misma categoría en tiempo real
function escucharNuevosViajes() {
  if (!perfilConductor || !perfilConductor.tipo_servicio) return;

  supabaseClient
    .channel('viajes-disponibles')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'viajes',
      filter: `tipo_servicio=eq.${perfilConductor.tipo_servicio}`
    }, () => {
      cargarViajesPendientes();
    })
    .subscribe();
}

async function aceptarViaje(idViaje) {
  const { error } = await supabaseClient
    .from('viajes')
    .update({ conductor_id: userConductor.id, estado: 'aceptado' })
    .eq('id', idViaje);

  if (error) {
    alert("No se pudo aceptar el viaje: " + error.message);
    return;
  }
  alert("🚀 ¡Viaje Aceptado!");
  cargarViajesPendientes();
}

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
    console.error("Error al obtener anuncios:", err);
  }
}

function cerrarModalAnuncio() {
  const modal = document.getElementById('modal-anuncio');
  if (modal) modal.classList.add('hidden');
}
