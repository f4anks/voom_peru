const SUPABASE_URL = 'https://gklquvthucityzgcamao.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  // Validar sesión activa
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) {
      window.location.href = 'index.html';
      return;
    }
  } catch (err) {
    console.error("Error al verificar sesión:", err);
    window.location.href = 'index.html';
    return;
  }

  const formRegistro = document.getElementById('form-registro-conductor');
  if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
      e.preventDefault();
      mostrarMensaje("Subiendo documentos y registrando datos...", "info");

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          window.location.href = 'index.html';
          return;
        }
        const user = session.user;

        // Función auxiliar para subir archivos al Storage de Supabase (Bucket: 'documentos')
        async function subirArchivo(fileInputId, nombreCarpeta) {
          const fileInput = document.getElementById(fileInputId);
          if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;
          
          const file = fileInput.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${nombreCarpeta}_${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabaseClient.storage
            .from('documentos')
            .upload(fileName, file, { upsert: true });

          if (uploadError) {
            throw new Error(`Error al subir ${nombreCarpeta}: ${uploadError.message}`);
          }

          // Obtener la URL pública del archivo subido
          const { data: { publicUrl } } = supabaseClient.storage
            .from('documentos')
            .getPublicUrl(fileName);

          return publicUrl;
        }

        // Subir las 5 imágenes requeridas
        const fotoCedula = await subirArchivo('file-cedula', 'cedula');
        const fotoLicencia = await subirArchivo('file-licencia', 'licencia');
        const fotoCarnet = await subirArchivo('file-carnet', 'carnet');
        const fotoTitulo = await subirArchivo('file-titulo', 'titulo');
        const fotoVehiculo = await subirArchivo('file-vehiculo', 'vehiculo');

        // Capturar los valores de los inputs de texto y fecha
        const nombre_completo = document.getElementById('reg-nombre').value.trim();
        const cedula = document.getElementById('reg-cedula').value.trim();
        const fecha_nacimiento = document.getElementById('reg-fnac').value;
        const licencia = document.getElementById('reg-licencia').value.trim();
        const carnet = document.getElementById('reg-carnet').value.trim();

        const vehiculo_placa = document.getElementById('veh-placa').value.trim().toUpperCase();
        const vehiculo_marca = document.getElementById('veh-marca').value.trim();
        const vehiculo_modelo = document.getElementById('veh-modelo').value.trim();
        const vehiculo_color = document.getElementById('veh-color').value.trim();
        const vehiculo_anio = parseInt(document.getElementById('veh-anio').value) || null;
        const vehiculo_titulo = document.getElementById('veh-titulo').value.trim();

        // Actualizar el perfil del usuario en Supabase con todos sus datos y estatus pendiente
        const { error: updateError } = await supabaseClient
          .from('perfiles')
          .update({
            nombre_completo,
            cedula,
            fecha_nacimiento,
            licencia,
            carnet,
            vehiculo_placa,
            vehiculo_marca,
            vehiculo_modelo,
            vehiculo_color,
            vehiculo_anio,
            vehiculo_titulo,
            foto_cedula: fotoCedula,
            foto_licencia: fotoLicencia,
            foto_carnet: fotoCarnet,
            foto_titulo: fotoTitulo,
            foto_vehiculo: fotoVehiculo,
            rol: 'conductor',
            estado_cuenta: 'pendiente'
          })
          .eq('id', user.id);

        if (updateError) throw updateError;

        mostrarMensaje("¡Documentación enviada con éxito! Redirigiendo...", "exito");

        setTimeout(() => {
          window.location.href = 'selector.html';
        }, 1500);

      } catch (err) {
        console.error("Error al registrar conductor:", err);
        mostrarMensaje(err.message || "Ocurrió un error al procesar el registro.", "error");
      }
    });
  }
});

function mostrarMensaje(texto, tipo) {
  const statusMsg = document.getElementById('status-message');
  if (!statusMsg) return;
  statusMsg.textContent = texto;
  statusMsg.classList.remove('hidden', 'bg-red-50', 'text-red-600', 'border-red-200', 'bg-emerald-50', 'text-emerald-600', 'border-emerald-200', 'bg-orange-50', 'text-orange-600', 'border-orange-200');

  if (tipo === 'error') {
    statusMsg.classList.add('bg-red-50', 'text-red-600', 'border-red-200');
  } else if (tipo === 'exito') {
    statusMsg.classList.add('bg-emerald-50', 'text-emerald-600', 'border-emerald-200');
  } else {
    statusMsg.classList.add('bg-orange-50', 'text-orange-600', 'border-orange-200');
  }
}
