// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://gklquvthucityzgcamao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM";

let supabaseClient = null;
let map = null;
let conductorMarker = null;
let userConductor = null;
let perfilConductor = null;

// Función para esperar la carga del SDK de Supabase en móviles
function esperarSupabase(intentos = 15) {
  return new Promise((resolve, reject) => {
    const verificar = (restantes) => {
      if (window.supabase && window.supabase.createClient) {
        resolve(window.supabase);
      } else if (restantes > 0) {
        setTimeout(() => verificar(restantes - 1), 300);
      } else {
        reject(new Error("Supabase SDK no disponible"));
      }
    };
    verificar(intentos);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const statusPanel = document.getElementById('status-panel');
    if (statusPanel) statusPanel.textContent = "Conectando con el servidor Voom...";

    let supabaseLib;
    try {
      supabaseLib = await esperarSupabase(15);
    } catch (e) {
      console.error("SDK de Supabase no cargado a tiempo.");
      mostrarErrorPantalla("Error de conexión: No se pudo cargar Supabase. Revisa tu red.");
      return;
    }

    supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabaseClient;

    // Validar sesión activa
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      window.location.href = 'index.html';
      return;
    }

    userConductor = user;
    
    if (typeof verificarAnunciosGlobales === 'function') {
      verificarAnunciosGlobales('conductor');
    }

    // Consultar perfil del conductor en Supabase incluyendo campos clave de registro
    const { data: perfil, error } = await supabaseClient
      .from('perfiles')
      .select('estado_cuenta, vehiculo_placa, vehiculo_matricula, nombre_completo, tipo_servicio, dni')
      .eq('id', user.id)
      .maybeSingle();

    // Validar si ya completó su registro anteriormente
    const estaRegistrado = perfil && (perfil.vehiculo_placa || perfil.vehiculo_matricula || perfil.dni);

    // Si no existe perfil o nunca se ha registrado, enviar al formulario de registro por única vez
    if (error || !perfil || !estaRegistrado) {
      window.location.href = 'registro_cond.html';
      return;
    }

    // Si ya está registrado pero su cuenta NO está aprobada (pendiente, suspendida, etc.),
    // enviar siempre a la pantalla de estatus dedicada para evitar duplicados.
    if (perfil.estado_cuenta !== 'aprobado') {
      window.location.href = 'index_status.html';
      return;
    }

    perfilConductor = perfil;

    const nombreDisplay = perfil.nombre_completo || user.user_metadata?.full_name || user.email.split('@')[0];
    const elGreeting = document.getElementById('conductor-greeting');
    if (elGreeting) {
      elGreeting.textContent = `Hola, ${nombreDisplay}`;
    }

    // --- PANEL APROBADO ---
    if (statusPanel) {
      statusPanel.textContent = `¡Cuenta Aprobada! Conéctate para recibir solicitudes (${(perfil.tipo_servicio || 'Servicio').toUpperCase()}).`;
      statusPanel.className = "p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold text-center";
    }

    // Inicializar Mapa de forma segura
    setTimeout(() => {
      const mapContainer = document.getElementById('map');
      if (mapContainer && typeof L !== 'undefined' && !map) {
        try {
          map = L.map('map', { zoomControl: false }).setView([-12.046374, -77.042793], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
              const lat = position.coords.latitude;
              const lng = position.coords.longitude;
              if (map) {
                map.setView([lat, lng], 15);
                conductorMarker = L.marker([lat, lng]).addTo(map).bindPopup("<b>Tu Vehículo</b>");
              }
            }, () => {}, { timeout: 10000, enableHighAccuracy: true });
          }
        } catch (mapErr) {
          console.warn("Mapa omitido temporalmente:", mapErr);
        }
      }
    }, 400);

    cargarViajesPendientes();
    escucharNuevosViajes();

  } catch (err) {
    console.error("Error general en conductor.js:", err);
    mostrarErrorPantalla("Ocurrió un error al cargar el panel: " + err.message);
  }
});

function mostrarErrorPantalla(mensaje) {
  const statusPanel = document.getElementById('status-panel');
  if (statusPanel) {
    statusPanel.className = "p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 font-bold text-center";
    statusPanel.textContent = mensaje;
  }
}

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
