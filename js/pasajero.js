let coordsOrigen = null;
let coordsDestino = null;

// Configuración de Tarifas de Voom
const CONFIG_TARIFA = {
  precioBase: 1.00,      // Bajada de bandera
  precioPorKm: 0.60,     // Valor del kilómetro recorrible
  tarifaMinima: 2.00     // Monto mínimo por viaje
};

document.addEventListener('DOMContentLoaded', () => {
  cargarNombreUsuario();
  
  // Consultar comunicados específicos para pasajeros usando el módulo externo
  if (typeof verificarAnunciosGlobales === 'function') {
    verificarAnunciosGlobales('pasajero');
  }
  
  // 1. Inicializar el mapa mediante la función de mapa.js
  inicializarMapa(10.5000, -66.9167);

  // 2. Conectar el clic del mapa con la lógica de destino y tarifas
  window.onMapaClickCallback = async (lat, lng) => {
    await establecerPuntoDestino(lat, lng);
  };

  obtenerUbicacionUsuario();
  inicializarBuscadorDestino();
});

// Cargar Nombre del Usuario con lectura prioritaria y formato exacto
async function cargarNombreUsuario() {
  const userNameEl = document.getElementById('user-name');
  if (!userNameEl) return;

  const nombreLocal = localStorage.getItem('voom_user_name');
  if (nombreLocal && nombreLocal.trim() !== '') {
    userNameEl.textContent = nombreLocal;
    return;
  }

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: perfil, error } = await supabaseClient
          .from('perfiles')
          .select('nombre_completo')
          .eq('id', user.id)
          .single();

        const nombre = perfil?.nombre_completo || user.user_metadata?.full_name || user.email.split('@')[0];
        const nombreFormateado = nombre.charAt(0).toUpperCase() + nombre.slice(1);
        
        userNameEl.textContent = nombreFormateado;
        localStorage.setItem('voom_user_name', nombreFormateado);
        return;
      }
    }
  } catch (err) {
    console.error("Error consultando sesión o perfil:", err);
  }

  userNameEl.textContent = "Pasajero";
}

// Inicializar buscador avanzado conectado al filtro seguro de mapa.js
function inicializarBuscadorDestino() {
  const inputDestino = document.getElementById('destino-txt');
  const contenedorSugerencias = document.getElementById('sugerencias-destino');
  
  if (!inputDestino || !contenedorSugerencias) return;

  let timeoutId;

  inputDestino.addEventListener('input', (e) => {
    clearTimeout(timeoutId);
    const query = e.target.value.trim();

    if (query.length < 3) {
      contenedorSugerencias.classList.add('hidden');
      contenedorSugerencias.innerHTML = '';
      return;
    }

    // Esperar a que el usuario termine de escribir (debounce de 400ms)
    timeoutId = setTimeout(async () => {
      try {
        // Usamos la función blindada de mapa.js que filtra por Venezuela y 50km
        const data = await buscarDestinosVenezuela(query);

        contenedorSugerencias.innerHTML = '';

        if (data && data.length > 0) {
          data.forEach(lugar => {
            const item = document.createElement('div');
            item.className = "px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600 cursor-pointer border-b border-slate-100 last:border-none truncate";
            
            // Mostrar nombre del sitio y la distancia calculada en km
            const distanciaInfo = lugar.distancia_km ? ` (${lugar.distancia_km.toFixed(1)} km)` : '';
            item.textContent = lugar.display_name + distanciaInfo;

            // Al hacer clic en una sugerencia de la lista
            item.addEventListener('click', async () => {
              inputDestino.value = lugar.display_name.split(',')[0]; 
              contenedorSugerencias.classList.add('hidden');
              
              const lat = parseFloat(lugar.lat);
              const lng = parseFloat(lugar.lon);
              
              await establecerPuntoDestino(lat, lng, lugar.display_name);
            });

            contenedorSugerencias.appendChild(item);
          });
          contenedorSugerencias.classList.remove('hidden');
        } else {
          contenedorSugerencias.classList.add('hidden');
        }
      } catch (err) {
        console.error("Error buscando sugerencias:", err);
      }
    }, 400);
  });

  // Ocultar sugerencias si se hace clic fuera del input
  document.addEventListener('click', (e) => {
    if (!inputDestino.contains(e.target) && !contenedorSugerencias.contains(e.target)) {
      contenedorSugerencias.classList.add('hidden');
    }
  });
}

// Buscar coordenadas escribiendo el destino mediante el filtro seguro
async function buscarDestinoPorTexto(query) {
  const inputDestino = document.getElementById('destino-txt');
  try {
    if (inputDestino) inputDestino.value = "Buscando ubicación...";

    const data = await buscarDestinosVenezuela(query);

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      await establecerPuntoDestino(lat, lng, data[0].display_name);
    } else {
      alert("No se encontró la dirección dentro de la zona permitida. Intenta con un nombre más específico.");
      if (inputDestino) inputDestino.value = query;
    }
  } catch (err) {
    console.error("Error en búsqueda de destino:", err);
    alert("Error de red al buscar el destino.");
  }
}

// Establecer Punto B (Destino)
async function establecerPuntoDestino(lat, lng, nombrePersonalizado = null) {
  coordsDestino = { lat, lng };

  // Validar radio máximo de cobertura (50 km desde el Origen)
  if (coordsOrigen) {
    const distanciaKm = calcularDistanciaLineal(coordsOrigen.lat, coordsOrigen.lng, lat, lng);
    if (distanciaKm > 50) {
      alert("El destino seleccionado está fuera de la zona de cobertura actual.");
      return;
    }
  }

  actualizarMarcadorDestino(lat, lng);
  centrarMapa(lat, lng, 15);

  const inputDestino = document.getElementById('destino-txt');
  if (nombrePersonalizado) {
    const partes = nombrePersonalizado.split(',');
    if (inputDestino) inputDestino.value = partes.slice(0, 2).join(',').trim();
  } else {
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`;
      const response = await fetch(url);
      const data = await response.json();
      if (inputDestino) {
        inputDestino.value = data.locality || `Punto seleccionado (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
    } catch (e) {
      if (inputDestino) inputDestino.value = `Punto seleccionado`;
    }
  }

  calcularTarifaViaje();
}

// Obtener Geolocalización del Origen (Punto A)
function obtenerUbicacionUsuario() {
  const inputOrigen = document.getElementById('origen-txt');

  if (!navigator.geolocation) {
    if (inputOrigen) inputOrigen.value = "Geolocalización no soportada";
    return;
  }

  if (inputOrigen) inputOrigen.value = "Obteniendo tu ubicación...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      coordsOrigen = { lat, lng };

      centrarMapa(lat, lng, 16);
      actualizarMarcadorOrigen(lat, lng);

      try {
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`;
        const response = await fetch(url);
        const data = await response.json();
        if (inputOrigen) {
          inputOrigen.value = `${data.locality || ''}${data.countryName ? ', ' + data.countryName : ''}`;
        }
      } catch (err) {
        if (inputOrigen) inputOrigen.value = `Ubicación actual (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
    },
    (error) => {
      let msj = "No se pudo obtener la ubicación";
      if (error.code === error.PERMISSION_DENIED) msj = "Permiso de GPS denegado";
      if (inputOrigen) inputOrigen.value = msj;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Cálculo de Distancia y Tarifa Dinámica por Kilómetro
async function calcularTarifaViaje() {
  if (!coordsOrigen || !coordsDestino) return;

  const precioBox = document.getElementById('precio-box');
  const distanciaTxt = document.getElementById('distancia-texto');
  const precioMonto = document.getElementById('precio-monto');

  try {
    const urlRoute = `https://router.project-osrm.org/route/v1/driving/${coordsOrigen.lng},${coordsOrigen.lat};${coordsDestino.lng},${coordsDestino.lat}?overview=false`;
    const response = await fetch(urlRoute);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const metros = data.routes[0].distance;
      const kilometros = (metros / 1000).toFixed(2);

      let precioFinal = CONFIG_TARIFA.precioBase + (kilometros * CONFIG_TARIFA.precioPorKm);
      if (precioFinal < CONFIG_TARIFA.tarifaMinima) {
        precioFinal = CONFIG_TARIFA.tarifaMinima;
      }

      if (distanciaTxt) distanciaTxt.textContent = `${kilometros} km de recorrido`;
      if (precioMonto) precioMonto.textContent = `$${precioFinal.toFixed(2)}`;
      if (precioBox) precioBox.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Error al calcular la ruta:", err);
  }
}

// Función auxiliar de distancia en línea recta
function calcularDistanciaLineal(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}
