// Configuración Global de Voom Perú (Tarifas Actualizadas)
const CONFIG_VOOM = {
  SUPABASE_URL: "https://gklquvthucityzgcamao.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM",
  
  // Coordenadas por defecto (C.C. Plaza Norte, Lima)
  UBICACION_DEFECTO: {
    lat: -11.9961,
    lng: -77.0583,
    nombre: "Centro Comercial Plaza Norte, Lima"
  },

  // Tarifas Incrementadas
  TARIFA: {
    precioBase: 5.00,      // Bajada de bandera (sube de 3.20 a 5.00 S/)
    precioPorKm: 1.50,     // Precio por km (sube de 0.90 a 1.50 S/)
    tarifaMinima: 7.00     // Tarifa mínima garantizada (sube de 4.50 a 7.00 S/)
  },

  // Multiplicadores por categoría ajustados al alza
  MULTIPLICADORES: {
    moto: 0.90,            // Envíos / Moto
    economico: 1.0,        // Referencia estándar
    confort: 1.35,         // Auto moderno con A/C
    flete: 2.50,           // Carga / Camioneta
    grua: 5.00             // Servicio de remolque 24/7
  }
};
