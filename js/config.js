// Configuración Global de Voom Perú (Tarifas Optimizadas)
const CONFIG_VOOM = {
  SUPABASE_URL: "https://gklquvthucityzgcamao.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM",
  
  // Coordenadas por defecto (C.C. Plaza Norte, Lima)
  UBICACION_DEFECTO: {
    lat: -11.9961,
    lng: -77.0583,
    nombre: "Centro Comercial Plaza Norte, Lima"
  },

  // Tarifas Balanceadas frente al mercado
  TARIFA: {
    precioBase: 7.00,      // Bajada de bandera óptima
    precioPorKm: 2.20,     // Precio por km competitivo
    tarifaMinima: 10.00    // Tarifa mínima garantizada para distancias cortas
  },

  // Multiplicadores por categoría
  MULTIPLICADORES: {
    moto: 0.85,            // Envíos / Moto (más económico)
    economico: 1.0,        // Referencia estándar de ciudad
    confort: 1.40,         // Auto moderno con A/C
    flete: 2.60,           // Carga / Camioneta
    grua: 5.00             // Servicio de remolque 24/7
  }
};
