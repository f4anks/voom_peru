async function guardarDatosConductor(event) {
  event.preventDefault();
  showMessage("Subiendo documentos y guardando perfil...", "info");

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  // Función auxiliar para subir un archivo individual al Storage de Supabase
  async function subirArchivo(fileInputId, nombreCarpeta) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput.files || fileInput.files.length === 0) return null;
    
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}_${nombreCarpeta}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('documentos-conductores')
      .upload(filePath, file);

    if (uploadError) {
      console.error(`Error subiendo ${nombreCarpeta}:`, uploadError.message);
      return null;
    }

    // Obtener URL pública de la imagen
    const { data } = supabaseClient.storage
      .from('documentos-conductores')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // Subir todas las fotos requeridas de forma simultánea
  const urlCedula = await subirArchivo('file-cedula', 'cedula');
  const urlLicencia = await subirArchivo('file-licencia', 'licencia');
  const urlCarnet = await subirArchivo('file-carnet', 'carnet');
  const urlTitulo = await subirArchivo('file-titulo', 'titulo');
  const urlVehiculo = await subirArchivo('file-vehiculo', 'vehiculo');

  // Objeto con toda la información unificada
  const datosActualizacion = {
    nombre_completo: document.getElementById('reg-nombre').value,
    cedula: document.getElementById('reg-cedula').value,
    fecha_nacimiento: document.getElementById('reg-fnac').value,
    licencia: document.getElementById('reg-licencia').value,
    carnet: document.getElementById('reg-carnet').value,
    vehiculo_placa: document.getElementById('veh-placa').value.toUpperCase(),
    vehiculo_marca: document.getElementById('veh-marca').value,
    vehiculo_modelo: document.getElementById('veh-modelo').value,
    vehiculo_color: document.getElementById('veh-color').value,
    vehiculo_anio: document.getElementById('veh-anio').value,
    vehiculo_titulo: document.getElementById('veh-titulo').value,
    foto_cedula: urlCedula,
    foto_licencia: urlLicencia,
    foto_carnet: urlCarnet,
    foto_titulo: urlTitulo,
    foto_vehiculo: urlVehiculo,
    estado_cuenta: 'pendiente'
  };

  const { error } = await supabaseClient
    .from('perfiles')
    .update(datosActualizacion)
    .eq('id', user.id);

  if (error) {
    console.error("Error al guardar en base de datos:", error);
    showMessage("Error al guardar: " + error.message, "error");
    return;
  }

  showMessage("¡Registro y documentos enviados con éxito! Redirigiendo...", "success");

  setTimeout(() => {
    window.location.href = 'conductor.html';
  }, 1500);
}
