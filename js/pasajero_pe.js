let coordsOrigen = null;
let coordsDestino = null;

// Configuración de Tarifas de Voom Perú (Soles)
const CONFIG_TARIFA = {
  precioBase: 4.00,      // Bajada de bandera (S/.)
  precioPorKm: 2.50,     // Valor del kilómetro recorrible
  tarifaMinima: 8.00     // Monto mínimo por viaje
};

document.addEventListener('DOMContentLoaded', () => {
  cargarNombreUsuario();
  
  if (typeof verificarAnunciosGlobales === 'function') {
    verificarAnunciosGlobales('pasajero');
  }
  
  // 1. Inicializar mapa de Perú (Lima por defecto mientras carga GPS)
  inicializarMapaPeru(-12.0464, -77.0428);

  // 2. Escuchar clics en el mapa para fijar el Destino
  window.onMapaClickCallback = async (lat, lng) => {
    await establecerPuntoDestino(lat, lng);
  };

  // 3. Cargar GPS de entrada + Activar buscadores manuales
  obtenerUbicacionUsuario();
  inicializarBuscadorOrigenPeru();
  inicializarBuscadorDestinoPeru();
});

// Cargar Nombre del Usuario
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
        const { data: perfil } = await supabaseClient
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
    console.error("Error consultando sesión:", err);
  }

  userNameEl.textContent = "Pasajero";
}

// 📍 BUSCADOR MANUAL DE ORIGEN (Permite cambiar el punto A si el usuario quiere)
function inicializarBuscadorOrigenPeru() {
  const inputOrigen = document.getElementById('origen-txt');
  const contenedorSugerencias = document.getElementById('sugerencias-origen');
  
  if (!inputOrigen || !contenedorSugerencias) return;

  let timeoutId;

  inputOrigen.addEventListener('input', (e) => {
    clearTimeout(timeoutId);
    const query = e.target.value.trim();

    if (query.length < 3) {
      contenedorSugerencias.classList.add('hidden');
      contenedorSugerencias.innerHTML = '';
      return;
    }

    timeoutId = setTimeout(async () => {
      try {
        const data = await buscarDestinosPeru(query);

        contenedorSugerencias.innerHTML = '';

        if (data && data.length > 0) {
          data.forEach(lugar => {
            const item = document.createElement('div');
            item.className = "px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer border-b border-slate-100 last:border-none truncate";
            item.textContent = lugar.display_name;

            item.addEventListener('click', () => {
              inputOrigen.value = lugar.display_name.split(',')[0]; 
              contenedorSugerencias.classList.add('hidden');
              
              const lat = parseFloat(lugar.lat);
              const lng = parseFloat(lugar.lon);
              
              // Actualizar Origen manual
              coordsOrigen = { lat, lng };
              actualizarMarcadorOrigen(lat, lng);
              centrarMapa(lat, lng, 15);

              // Recalcular precio si el destino ya estaba seleccionado
              if (coordsDestino) {
                calcularTarifaViaje();
              }
            });

            contenedorSugerencias.appendChild(item);
          });
          contenedorSugerencias.classList.remove('hidden');
        } else {
          contenedorSugerencias.classList.add('hidden');
        }
      } catch (err) {
        console.error("Error buscando sugerencias de origen:", err);
      }
    }, 400);
  });

  // Ocultar si hace clic fuera
  document.addEventListener('click', (e) => {
    if (!inputOrigen.contains(e.target) && !contenedorSugerencias.contains(e.target)) {
      contenedorSugerencias.classList.add('hidden');
    }
  });
}

// 🏁 BUSCADOR MANUAL DE DESTINO (Punto B)
function inicializarBuscadorDestinoPeru() {
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

    timeoutId = setTimeout(async () => {
      try {
        const data = await buscarDestinosPeru(query);

        contenedorSugerencias.innerHTML = '';

        if (data && data.length > 0) {
          data.forEach(lugar => {
            const item = document.createElement('div');
            item.className = "px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-600 cursor-pointer border-b border-slate-100 last:border-none truncate";
            
            const distanciaInfo = lugar.distancia_km ? ` (${lugar.distancia_km.toFixed(1)} km)` : '';
            item.textContent = lugar.display_name + distanciaInfo;

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
        console.error("Error buscando sugerencias en Perú:", err);
      }
    }, 400);
  });

  document.addEventListener('click', (e) => {
    if (!inputDestino.contains(e.target) && !contenedorSugerencias.contains(e.target)) {
      contenedorSugerencias.classList.add('hidden');
    }
  });
}

// Establecer Punto B (Destino)
async function establecerPuntoDestino(lat, lng, nombrePersonalizado = null) {
  coordsDestino = { lat, lng };

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

// 📡 OBTENER GEOLOCALIZACIÓN AUTOMÁTICA DEL USUARIO
function obtenerUbicacionUsuario() {
  const inputOrigen = document.getElementById('origen-txt');

  if (!navigator.geolocation) {
    if (inputOrigen) inputOrigen.placeholder = "Punto de origen manual...";
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
      // Si se deniega el GPS, permitimos escribir manualmente sin bloquear la pantalla
      if (inputOrigen) {
        inputOrigen.value = "";
        inputOrigen.placeholder = "Ingresa origen manualmente...";
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// 💵 CÁLCULO DE TARIFA Y RUTA
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
      if (precioMonto) precioMonto.textContent = `S/. ${precioFinal.toFixed(2)}`;
      if (precioBox) precioBox.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Error al calcular la ruta:", err);
  }
}

// Distancia lineal Haversine auxiliar
function calcularDistanciaLineal(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}
