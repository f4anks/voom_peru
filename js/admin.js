const SUPABASE_URL = "https://gklquvthucityzgcamao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM";

let supabaseClient = null;
let todosLosConductores = [];
let filtroActual = 'todos';

window.addEventListener('DOMContentLoaded', async () => {
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("SDK de Supabase no cargado.");
    return;
  }

  // Validar Sesión
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const elEmail = document.getElementById('admin-email');
  if (elEmail) elEmail.innerText = user.email;

  await cargarConductores();
});

async function cargarConductores() {
  const { data, error } = await supabaseClient
    .from('perfiles')
    .select('*')
    .eq('rol', 'conductor')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error cargando conductores:", error);
    return;
  }

  todosLosConductores = data || [];
  actualizarContadores();
  renderizarConductores();
}

function actualizarContadores() {
  const elTodos = document.getElementById('count-todos');
  const elPendiente = document.getElementById('count-pendiente');
  const elAprobado = document.getElementById('count-aprobado');
  const elSuspendido = document.getElementById('count-suspendido');

  if (elTodos) elTodos.innerText = todosLosConductores.length;
  if (elPendiente) elPendiente.innerText = todosLosConductores.filter(c => c.estado_cuenta === 'pendiente').length;
  if (elAprobado) elAprobado.innerText = todosLosConductores.filter(c => c.estado_cuenta === 'aprobado').length;
  if (elSuspendido) elSuspendido.innerText = todosLosConductores.filter(c => c.estado_cuenta === 'suspendido').length;
}

function filtrarConductores(tipo) {
  filtroActual = tipo;

  ['todos', 'pendiente', 'aprobado', 'suspendido'].forEach(tab => {
    const btn = document.getElementById(`tab-${tab}`);
    if (btn) {
      if (tab === tipo) {
        btn.className = "px-4 py-2 text-xs font-bold rounded-xl bg-white text-orange-600 shadow-xs transition-all";
      } else {
        btn.className = "px-4 py-2 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-800 transition-all";
      }
    }
  });

  renderizarConductores();
}

function renderizarConductores() {
  const contenedor = document.getElementById('contenedor-conductores');
  if (!contenedor) return;
  contenedor.innerHTML = '';

  let lista = todosLosConductores;
  if (filtroActual !== 'todos') {
    lista = todosLosConductores.filter(c => c.estado_cuenta === filtroActual);
  }

  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="col-span-full text-center py-12 text-xs font-semibold text-slate-400">No hay conductores en esta categoría.</p>';
    return;
  }

  lista.forEach(c => {
    const badgeEstado = obtenerBadgeEstado(c.estado_cuenta);
    const card = document.createElement('div');
    card.className = "bg-white p-5 rounded-3xl border border-slate-200/80 shadow-[0_10px_25px_-10px_rgba(0,0,0,0.05)] space-y-4 flex flex-col justify-between";

    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-sm font-black text-slate-900">${c.nombre_completo || 'Sin nombre'}</h3>
            <p class="text-xs font-bold text-orange-600">C.I: ${c.cedula || 'N/A'}</p>
          </div>
          ${badgeEstado}
        </div>

        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-[11px] space-y-1 text-slate-600">
          <p><strong class="text-slate-800">Vehículo:</strong> ${c.vehiculo_marca || ''} ${c.vehiculo_modelo || ''} (${c.vehiculo_anio || ''})</p>
          <p><strong class="text-slate-800">Placa:</strong> <span class="font-bold uppercase text-slate-900">${c.vehiculo_placa || 'N/A'}</span></p>
          <p><strong class="text-slate-800">Color:</strong> ${c.vehiculo_color || 'N/A'}</p>
        </div>
      </div>

      <div class="space-y-2 pt-2 border-t border-slate-100">
        <button onclick="verDocumentos('${c.id}')" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-all">
          📄 Ver Documentos / Fotos
        </button>

        <div class="grid grid-cols-2 gap-2">
          ${c.estado_cuenta !== 'aprobado' 
            ? `<button onclick="cambiarEstadoConductor('${c.id}', 'aprobado')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs">Aprobar</button>` 
            : ''}
          ${c.estado_cuenta !== 'suspendido' 
            ? `<button onclick="cambiarEstadoConductor('${c.id}', 'suspendido')" class="bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs col-span-1">Suspender</button>` 
            : ''}
          ${c.estado_cuenta === 'aprobado' 
            ? `<button onclick="cambiarEstadoConductor('${c.id}', 'pendiente')" class="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs">Marcar Pendiente</button>` 
            : ''}
        </div>
      </div>
    `;

    contenedor.appendChild(card);
  });
}

function obtenerBadgeEstado(estado) {
  if (estado === 'aprobado') {
    return `<span class="text-[10px] bg-emerald-50 text-emerald-700 font-black px-2.5 py-1 rounded-full border border-emerald-200">Aprobado</span>`;
  } else if (estado === 'suspendido') {
    return `<span class="text-[10px] bg-red-50 text-red-600 font-black px-2.5 py-1 rounded-full border border-red-200">Suspendido</span>`;
  }
  return `<span class="text-[10px] bg-amber-50 text-amber-700 font-black px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">Pendiente</span>`;
}

async function cambiarEstadoConductor(idConductor, nuevoEstado) {
  const { error } = await supabaseClient
    .from('perfiles')
    .update({ estado_cuenta: nuevoEstado })
    .eq('id', idConductor);

  if (error) {
    alert("Error al actualizar estado: " + error.message);
    return;
  }

  await cargarConductores();
}

function verDocumentos(idConductor) {
  const conductor = todosLosConductores.find(c => c.id === idConductor);
  if (!conductor) return;

  const elTitulo = document.getElementById('modal-titulo-conductor');
  if (elTitulo) elTitulo.innerText = `Documentos: ${conductor.nombre_completo || 'Conductor'}`;
  
  const cuerpo = document.getElementById('modal-cuerpo-docs');
  if (!cuerpo) return;

  const docs = [
    { titulo: 'Cédula de Identidad', url: conductor.foto_cedula },
    { titulo: 'Licencia de Conducir', url: conductor.foto_licencia },
    { titulo: 'Carnet de Circulación', url: conductor.foto_carnet },
    { titulo: 'Título de Propiedad', url: conductor.foto_titulo },
    { titulo: 'Fotografía del Vehículo', url: conductor.foto_vehiculo }
  ];

  cuerpo.innerHTML = docs.map(d => `
    <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
      <p class="text-xs font-bold text-slate-700 mb-2">${d.titulo}</p>
      ${d.url 
        ? `<a href="${d.url}" target="_blank"><img src="${d.url}" class="w-full h-36 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-all" alt="${d.titulo}" /></a>` 
        : '<div class="h-36 flex items-center justify-center bg-slate-100 text-xs text-slate-400 font-medium rounded-xl">Sin fotografía cargada</div>'}
    </div>
  `).join('');

  const modal = document.getElementById('modal-docs');
  if (modal) modal.classList.remove('hidden');
}

function cerrarModalDocs() {
  const modal = document.getElementById('modal-docs');
  if (modal) modal.classList.add('hidden');
}

async function logoutAdmin() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  window.location.href = 'index.html';
}

// Exponer las funciones globalmente para el panel administrativo
window.filtrarConductores = filtrarConductores;
window.cambiarEstadoConductor = cambiarEstadoConductor;
window.verDocumentos = verDocumentos;
window.cerrarModalDocs = cerrarModalDocs;
window.logoutAdmin = logoutAdmin;
