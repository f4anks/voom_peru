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

  // Configuración de Tarifas de Voom Ajustadas
  TARIFA: {
    precioBase: 3.20,      // Bajada de bandera (sube de 1.00 a 3.20)
    precioPorKm: 0.90,     // Precio por cada km (ajustado de 0.50 a 0.90)
    tarifaMinima: 4.50     // Tarifa mínima base
  },

  // Multiplicadores por categoría de servicio (Ajustados para evitar disparos de precio)
  MULTIPLICADORES: {
    moto: 0.85,
    economico: 1.0,        // Referencia base 1:1
    confort: 1.25,         // Reducido de 2.0 a 1.25 (Pasa de 15.36 a ~6.70)
    flete: 2.2,
    grua: 4.5
  }
};
