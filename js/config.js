// Configuración Global de Voom Perú
const CONFIG_VOOM = {
  SUPABASE_URL: "https://gklquvthucityzgcamao.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM",
  
  // Coordenadas por defecto (Lima, Perú)
  UBICACION_DEFECTO: {
    lat: -12.046374,
    lng: -77.042793,
    nombre: "Lima, Perú"
  },

  // Configuración de Tarifas de Voom
  TARIFA: {
    precioBase: 1.00,      // Tarifa fija de inicio / bajada de bandera
    precioPorKm: 0.50,     // Precio por cada kilómetro recorrido
    tarifaMinima: 2.00     // Tarifa mínima por cualquier carrera corta
  },

  // Multiplicadores por categoría de servicio
  MULTIPLICADORES: {
    moto: 1.0,
    economico: 1.5,
    confort: 2.0,
    flete: 3.5,
    grua: 6.0
  }
};
