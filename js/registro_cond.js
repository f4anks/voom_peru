// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://gklquvthucityzgcamao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM";

let supabaseClient = null;
let currentUser = null;

// Esperar disponibilidad del SDK de Supabase
function esperarSupabase(intentos = 15) {
  return new Promise((resolve, reject) => {
    const verificar = (restantes) => {
      if (window.supabase && window.supabase.createClient) {
        resolve(window.supabase);
      } else if (restantes > 0) {
        setTimeout(() => verificar(restantes - 1), 300);
      } else {
        reject(new Error("SDK Supabase no disponible"));
      }
    };
    verificar(intentos);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  const statusBox = document.getElementById('status-registro');

  try {
    const supabaseLib = await esperarSupabase();
    supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
      window.location.href = 'index.html';
      return;
    }
    currentUser = user;

    // Cargar nombre predeterminado si existe en la sesión
    const elNombre = document.getElementById('nombre_completo');
    if (elNombre && !elNombre.value) {
      elNombre.value = user.user_metadata?.full_name || '';
    }

  } catch (err) {
    mostrarMensaje('Error de conexión con la base de datos: ' + err.message, true);
  }

  const form = document.getElementById('form-registro');
  if (form) {
    form.addEventListener('submit', procesarRegistro);
  }
});

// Función de compresión de fotos para acelerar la subida móvil
function comprimirImagen(file, maxWidth = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Error al comprimir la imagen"));
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// Subir un archivo al Storage de Supabase
async function subirArchivoStorage(fileInputId, carpetaNombre) {
  const input = document.getElementById(fileInputId);
  if (!input || !input.files || input.files.length === 0) return null;

  const archivoOriginal = input.files[0];
  mostrarMensaje(`Procesando y subiendo: ${carpetaNombre}...`);

  // Comprimir foto si es formato de imagen
  let blobFinal = archivoOriginal;
  if (archivoOriginal.type.startsWith('image/')) {
    blobFinal = await comprimirImagen(archivoOriginal);
  }

  const extension = 'jpg';
  const filePath = `conductores/${currentUser.id}/${carpetaNombre}_${Date.now()}.${extension}`;

  const { data, error } = await supabaseClient
    .storage
    .from('documentos')
    .upload(filePath, blobFinal, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) {
    throw new Error(`Error al subir ${carpetaNombre}: ${error.message}`);
  }

  const { data: publicUrlData } = supabaseClient
    .storage
    .from('documentos')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

async function procesarRegistro(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Subiendo fotos y guardando...';
  }

  try {
    mostrarMensaje('Subiendo documentación y fotografías capturadas...');

    // 1. Subir archivos a Supabase Storage
    const urlBrevete = await subirArchivoStorage('foto_brevete', 'brevete');
    const urlCarta = await subirArchivoStorage('foto_carta_conducta', 'carta_conducta');
    const urlTitulo = await subirArchivoStorage('foto_titulo_vehiculo', 'titulo_vehiculo');
    const urlFrontal = await subirArchivoStorage('foto_frontal', 'foto_frontal');
    const urlLateral = await subirArchivoStorage('foto_lateral', 'foto_lateral');

    // 2. Recopilar todos los campos de texto
    const nombreCompleto = document.getElementById('nombre_completo').value.trim();
    const dni = document.getElementById('dni').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const tipoServicio = document.getElementById('tipo_servicio').value;
    const placa = document.getElementById('vehiculo_placa').value.trim().toUpperCase();
    const marca = document.getElementById('vehiculo_marca').value.trim();
    const modelo = document.getElementById('vehiculo_modelo').value.trim();
    const anio = parseInt(document.getElementById('vehiculo_anio').value, 10);
    const color = document.getElementById('vehiculo_color').value.trim();

    mostrarMensaje('Guardando datos del perfil...');

    // 3. Actualizar la tabla `perfiles` en Supabase
    const { error: updateError } = await supabaseClient
      .from('perfiles')
      .update({
        nombre_completo: nombreCompleto,
        dni: dni,
        telefono: telefono,
        tipo_servicio: tipoServicio,
        vehiculo_placa: placa,
        vehiculo_marca: marca,
        vehiculo_modelo: modelo,
        vehiculo_anio: anio,
        vehiculo_color: color,
        url_foto_brevete: urlBrevete,
        url_foto_carta_conducta: urlCarta,
        url_foto_titulo_vehiculo: urlTitulo,
        url_foto_frontal: urlFrontal,
        url_foto_lateral: urlLateral,
        estado_cuenta: 'pendiente', // Deja la cuenta en espera de aprobación
        updated_at: new Date()
      })
      .eq('id', currentUser.id);

    if (updateError) {
      throw updateError;
    }

    mostrarMensaje('✅ ¡Registro completado con éxito! Redirigiendo...', false);
    
    setTimeout(() => {
      window.location.href = 'index_status.html';
    }, 1200);

  } catch (err) {
    console.error('Error durante el registro:', err);
    mostrarMensaje('❌ No se pudo completar el registro: ' + err.message, true);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Enviar Datos y Documentos para Aprobación';
    }
  }
}

function mostrarMensaje(texto, esError = false) {
  const box = document.getElementById('status-registro');
  if (!box) return;

  box.classList.remove('hidden');
  box.textContent = texto;

  if (esError) {
    box.className = "p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-bold";
  } else {
    box.className = "p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-800 font-bold";
  }
}
