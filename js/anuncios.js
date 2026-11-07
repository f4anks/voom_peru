// js/anuncios.js - Módulo unificado para Anuncios Globales (Realtime + Web Push)

// CONFIGURACIÓN DE ONESIGNAL
const ONESIGNAL_APP_ID = "TU_ONESIGNAL_APP_ID"; // Reemplaza por tu App ID de OneSignal
const ONESIGNAL_REST_KEY = "TU_ONESIGNAL_REST_API_KEY"; // Reemplaza por tu REST API Key

function obtenerClienteSupabase() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    return supabaseClient;
  }
  if (window.supabase && window.supabase.createClient) {
    return window.supabase.createClient(
      "https://gklquvthucityzgcamao.supabase.co",
      "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM"
    );
  }
  return null;
}

// 1. Transmitir Anuncio (Admin)
async function enviarAnuncioGlobal() {
  const client = obtenerClienteSupabase();
  const elTitulo = document.getElementById('anuncio-titulo');
  const elMensaje = document.getElementById('anuncio-mensaje');
  const elDestinatario = document.getElementById('anuncio-destinatario');
  const elStatus = document.getElementById('anuncio-status');

  if (!elTitulo || !elMensaje || !elDestinatario || !client) return;

  const titulo = elTitulo.value.trim();
  const mensaje = elMensaje.value.trim();
  const destinatario = elDestinatario.value;

  if (!titulo || !mensaje) {
    alert("Por favor completa el título y el mensaje del anuncio.");
    return;
  }

  if (elStatus) {
    elStatus.textContent = "Transmitiendo anuncio...";
    elStatus.className = "text-xs font-bold text-orange-600";
  }

  try {
    // A. Guardar en Supabase para el historial y Realtime
    const { error } = await client
      .from('anuncios')
      .insert([{ 
        titulo: titulo, 
        mensaje: mensaje, 
        destinatario: destinatario,
        created_at: new Date() 
      }]);

    if (error) throw error;

    // B. Enviar Notificación Push en segundo plano vía OneSignal
    await dispararNotificacionPush(titulo, mensaje, destinatario);

    if (elStatus) {
      elStatus.textContent = `¡Anuncio enviado exitosamente a: ${destinatario.toUpperCase()}! 🚀`;
      elStatus.className = "text-xs font-bold text-emerald-600";
    }

    elTitulo.value = '';
    elMensaje.value = '';

    setTimeout(() => {
      if (elStatus) elStatus.textContent = '';
    }, 4000);

  } catch (err) {
    console.error("Error al enviar anuncio:", err);
    if (elStatus) {
      elStatus.textContent = "Error al enviar: " + err.message;
      elStatus.className = "text-xs font-bold text-red-600";
    }
  }
}

// Envío de Notificación Push para apps cerradas/en segundo plano
async function dispararNotificacionPush(titulo, mensaje, destinatario) {
  if (ONESIGNAL_APP_ID.includes("TU_ONESIGNAL") || ONESIGNAL_REST_KEY.includes("TU_ONESIGNAL")) {
    console.warn("OneSignal Keys no configuradas aún en js/anuncios.js");
    return;
  }

  // Mapeo de segmentos de audiencia en OneSignal
  let includeSegments = ["Subscribed Users"];
  if (destinatario === 'pasajeros') {
    includeSegments = ["Pasajeros"]; // Filtro por Tag en OneSignal
  } else if (destinatario === 'conductores') {
    includeSegments = ["Conductores"]; // Filtro por Tag en OneSignal
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    headings: { es: titulo, en: titulo },
    contents: { es: mensaje, en: mensaje },
    included_segments: includeSegments,
    chrome_web_icon: "./icons/icon-192.png"
  };

  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_KEY}`
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Error despachando Push:", err);
  }
}

// 2. Mostrar Modal visualmente (App en primer plano)
function desplegarModalAnuncio(titulo, mensaje) {
  const modal = document.getElementById('modal-anuncio');
  const tituloEl = document.getElementById('anuncio-modal-titulo');
  const mensajeEl = document.getElementById('anuncio-modal-mensaje');

  if (modal && tituloEl && mensajeEl) {
    tituloEl.textContent = titulo || "Comunicado Oficial";
    mensajeEl.textContent = mensaje || "";
    modal.classList.remove('hidden');
  }
}

// 3. Verificar al cargar la página + Escuchar en tiempo real
async function verificarAnunciosGlobales(tipoRol = 'pasajero') {
  try {
    const client = obtenerClienteSupabase();
    if (!client) return;

    const rolesPermitidos = tipoRol === 'conductor' 
      ? ['todos', 'conductores'] 
      : ['todos', 'pasajeros'];

    const keyStorage = tipoRol === 'conductor' 
      ? 'voom_ultimo_anuncio_id_conductor' 
      : 'voom_ultimo_anuncio_id_pasajero';

    // A. Revisar último anuncio al iniciar
    const { data, error } = await client
      .from('anuncios')
      .select('*')
      .in('destinatario', rolesPermitidos)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const ultimoAnuncio = data[0];
      const ultimoVistoId = localStorage.getItem(keyStorage);

      if (String(ultimoVistoId) !== String(ultimoAnuncio.id)) {
        desplegarModalAnuncio(ultimoAnuncio.titulo, ultimoAnuncio.mensaje);
        localStorage.setItem(keyStorage, ultimoAnuncio.id);
      }
    }

    // B. Escuchar en TIEMPO REAL (app en primer plano)
    client
      .channel('cambios-anuncios-globales')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'anuncios' },
        (payload) => {
          const nuevoAnuncio = payload.new;
          if (rolesPermitidos.includes(nuevoAnuncio.destinatario)) {
            desplegarModalAnuncio(nuevoAnuncio.titulo, nuevoAnuncio.mensaje);
            localStorage.setItem(keyStorage, nuevoAnuncio.id);
          }
        }
      )
      .subscribe();

  } catch (err) {
    console.error(`Error en anuncios en tiempo real (${tipoRol}):`, err);
  }
}

// 4. Cerrar el Modal
function cerrarModalAnuncio() {
  const modal = document.getElementById('modal-anuncio');
  if (modal) modal.classList.add('hidden');
}

// Exponer funciones globalmente
window.enviarAnuncioGlobal = enviarAnuncioGlobal;
window.verificarAnunciosGlobales = verificarAnunciosGlobales;
window.cerrarModalAnuncio = cerrarModalAnuncio;
