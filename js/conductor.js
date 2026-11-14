// ==========================================
// js/conductor.js - Lógica Integral del Conductor
// ==========================================

let supabaseClient = null;
let map = null;
let conductorMarker = null;
let userConductor = null;
let perfilConductor = null;
let viajeActivoId = null;

// Espera segura de Supabase
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

    supabaseClient = supabaseLib.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
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

    // Consultar perfil del conductor
    const { data: perfil, error } = await supabaseClient
      .from('perfiles')
      .select('estado_cuenta, vehiculo_placa, vehiculo_matricula, nombre_completo, tipo_servicio, dni')
      .eq('id', user.id)
      .maybeSingle();

    const estaRegistrado = perfil && (perfil.vehiculo_placa || perfil.vehiculo_matricula || perfil.dni);

    if (error || !perfil || !estaRegistrado) {
      window.location.href = 'registro_cond.html';
      return;
    }

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

    if (statusPanel) {
      statusPanel.textContent = `¡Cuenta Aprobada! Servicio: ${(perfil.tipo_servicio || 'Servicio').toUpperCase()}`;
      statusPanel.className = "p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold text-center";
    }

    // Inicializar Mapa
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

    // Verificar si ya tiene un viaje activo en curso o aceptado
    await verificarViajeActivoConductor();

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
  if (viajeActivoId) return; // Si ya tiene un viaje en curso, no muestra la lista de pendientes

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
      table: 'viajes'
    }, () => {
      if (!viajeActivoId) {
        cargarViajesPendientes();
      }
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

  viajeActivoId = idViaje;
  alert("🚀 ¡Viaje Aceptado!");
  mostrarPanelViajeActivo('aceptado', idViaje);
}

async function verificarViajeActivoConductor() {
  const { data, error } = await supabaseClient
    .from('viajes')
    .select('*')
    .eq('conductor_id', userConductor.id)
    .in('estado', ['aceptado', 'en_curso'])
    .maybeSingle();

  if (!error && data) {
    viajeActivoId = data.id;
    mostrarPanelViajeActivo(data.estado, data.id);
  }
}

function mostrarPanelViajeActivo(estado, idViaje) {
  const contenedor = document.getElementById('lista-viajes');
  if (!contenedor) return;

  let textoEstado = estado === 'aceptado' ? "Viaje Aceptado - Dirígete al origen" : "Viaje en Progreso hacia el destino";
  let siguienteBotonHTML = estado === 'aceptado' 
    ? `<button onclick="actualizarEstadoViaje('${idViaje}', 'en_curso')" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs uppercase shadow-md transition-all">Iniciar Viaje ➔</button>`
    : `<button onclick="actualizarEstadoViaje('${idViaje}', 'completado')" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase shadow-md transition-all">Finalizar Viaje ✅</button>`;

  contenedor.innerHTML = `
    <div class="p-5 bg-orange-50 border-2 border-orange-300 rounded-2xl space-y-3 text-center shadow-md">
      <span class="text-[10px] font-black uppercase bg-orange-200 text-orange-900 px-2.5 py-1 rounded-full">${textoEstado}</span>
      <p class="text-xs font-bold text-slate-700">Gestiona tu servicio activo en tiempo real.</p>
      ${siguienteBotonHTML}
    </div>
  `;
}

async function actualizarEstadoViaje(idViaje, nuevoEstado) {
  const { error } = await supabaseClient
    .from('viajes')
    .update({ estado: nuevoEstado })
    .eq('id', idViaje);

  if (error) {
    alert("Error al actualizar estado: " + error.message);
    return;
  }

  if (nuevoEstado === 'completado') {
    alert("🏁 ¡Viaje finalizado con éxito!");
    viajeActivoId = null;
    cargarViajesPendientes();
  } else {
    verificarViajeActivoConductor();
  }
}
