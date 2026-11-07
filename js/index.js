// Inicialización del cliente Supabase (Reemplaza con tus llaves reales)
const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_KEY = 'tu-anon-key';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
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

        // Extraer nombre del usuario y guardar en localStorage
        const nombreUsuario = data.user.user_metadata?.full_name || email.split('@')[0];
        localStorage.setItem('voom_user_name', nombreUsuario);

        mostrarMensaje("¡Bienvenido a Voom!", "éxito");

        setTimeout(() => {
          window.location.href = 'pasajero.html';
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

        // Guardar el nombre en el navegador inmediatamente
        localStorage.setItem('voom_user_name', name);

        mostrarMensaje("Cuenta creada exitosamente.", "éxito");

        setTimeout(() => {
          if (role === 'conductor') {
            window.location.href = 'conductor.html';
          } else {
            window.location.href = 'pasajero.html';
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
