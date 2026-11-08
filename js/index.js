// Inicialización del cliente Supabase con tus credenciales reales
const SUPABASE_URL = 'https://gklquvthucityzgcamao.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-p-YL6bWXAQGTddkmm9_mA_HgKlR_eM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  // 1. VALIDACIÓN DE SEGURIDAD: Bloquear si se ejecuta en navegador web normal
  if (!verificarModoStandalone()) {
    bloquearAccesoWeb();
    return;
  }

  // 2. SESIÓN PERSISTENTE: Si ya hay una sesión activa, entrar directo a la app sin pedir clave
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
      const role = session.user.user_metadata?.role || 'pasajero';
      window.location.href = role === 'conductor' ? 'conductor.html' : 'pasajero_pe.html';
      return;
    }
  } catch (err) {
    console.error("Error al verificar sesión guardada:", err);
  }

  const btnTabLogin = document.getElementById('btn-tab-login');
  const btnTabRegister = document.getElementById('btn-tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const statusMsg = document.getElementById('status-message');

  // Alternar entre Login y Registro
  if (btnTabLogin && btnTabRegister) {
    btnTabLogin.addEventListener('click', () => {
      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
      btnTabLogin.className = "flex-1 py-2.5 text-xs font-bold rounded-xl bg-white text-orange-600 shadow-sm transition-all duration-200";
      btnTabRegister.className = "flex-1 py-2.5 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-800 transition-all duration-200";
    });

    btnTabRegister.addEventListener('click', () => {
      formRegister.classList.remove('hidden');
      formLogin.classList.add('hidden');
      btnTabRegister.className = "flex-1 py-2.5 text-xs font-bold rounded-xl bg-white text-orange-600 shadow-sm transition-all duration-200";
      btnTabLogin.className = "flex-1 py-2.5 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-800 transition-all duration-200";
    });
  }

  // Manejo de Iniciar Sesión
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      mostrarMensaje("Iniciando sesión...", "info");

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) throw error;

        const nombreUsuario = data.user.user_metadata?.full_name || email.split('@')[0];
        localStorage.setItem('voom_user_name', nombreUsuario);

        mostrarMensaje("¡Bienvenido a Voom Perú!", "éxito");

        setTimeout(() => {
          window.location.href = 'pasajero_pe.html';
        }, 1000);

      } catch (err) {
        mostrarMensaje(err.message || "Error al iniciar sesión", "error");
      }
    });
  }

  // Manejo de Registro
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const role = document.querySelector('input[name="role"]:checked')?.value || 'pasajero';

      mostrarMensaje("Creando tu cuenta...", "info");

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: { full_name: name, role: role }
          }
        });

        if (error) throw error;

        localStorage.setItem('voom_user_name', name);

        mostrarMensaje("Cuenta creada exitosamente.", "éxito");

        setTimeout(() => {
          if (role === 'conductor') {
            window.location.href = 'conductor.html';
          } else {
            window.location.href = 'pasajero_pe.html';
          }
        }, 1000);

      } catch (err) {
        mostrarMensaje(err.message || "Error al crear la cuenta", "error");
      }
    });
  }

  function mostrarMensaje(texto, tipo) {
    if (!statusMsg) return;
    statusMsg.textContent = texto;
    statusMsg.classList.remove('hidden', 'bg-red-50', 'text-red-600', 'border-red-200', 'bg-emerald-50', 'text-emerald-600', 'border-emerald-200', 'bg-slate-50', 'text-slate-600', 'border-slate-200');

    if (tipo === 'error') {
      statusMsg.classList.add('bg-red-50', 'text-red-600', 'border-red-200');
    } else if (tipo === 'éxito') {
      statusMsg.classList.add('bg-emerald-50', 'text-emerald-600', 'border-emerald-200');
    } else {
      statusMsg.classList.add('bg-slate-50', 'text-slate-600', 'border-slate-200');
    }
  }
});

// Función para comprobar si la PWA se abrió instalada
function verificarModoStandalone() {
  return (window.matchMedia('(display-mode: standalone)').matches) || 
         (window.navigator.standalone === true) || 
         document.referrer.includes('android-app://');
}

// Función que bloquea la pantalla si se abre en el navegador web
function bloquearAccesoWeb() {
  const appContent = document.getElementById('app-content');
  const installOverlay = document.getElementById('pwa-install-overlay');

  if (appContent) {
    appContent.classList.add('hidden');
  }

  if (installOverlay) {
    installOverlay.classList.remove('hidden');

    const cajaModal = installOverlay.querySelector('.max-w-sm');
    if (cajaModal) {
      cajaModal.innerHTML = `
        <div class="inline-flex items-center justify-center w-20 h-20 bg-red-500 rounded-3xl text-white shadow-xl shadow-red-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <div>
          <h2 class="text-2xl font-black text-slate-900 tracking-tight">Acceso Restringido</h2>
          <p class="text-xs font-medium text-slate-500 mt-2 leading-relaxed">
            Por seguridad, <strong>Voom</strong> no puede utilizarse desde el navegador web. Debes instalar y abrir la aplicación desde tu pantalla de inicio.
          </p>
        </div>
        <button id="btn-pwa-install-forced" class="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-500/30 text-sm tracking-wide">
          Instalar Aplicación Ahora 🚀
        </button>
      `;

      setTimeout(() => {
        const btnForced = document.getElementById('btn-pwa-install-forced');
        if (btnForced) {
          btnForced.addEventListener('click', async () => {
            if (window.deferredPrompt) {
              window.deferredPrompt.prompt();
              await window.deferredPrompt.userChoice;
              window.deferredPrompt = null;
            } else {
              alert("Toca los tres puntos (⋮) de Chrome y selecciona 'Agregar a la pantalla principal' o 'Instalar aplicación'.");
            }
          });
        }
      }, 100);
    }
  }
}
