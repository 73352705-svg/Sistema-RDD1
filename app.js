/**
 * SISTEMA DE REGISTRO Y DISTRIBUCIÓN DE DOCUMENTOS
 * Lógica de Frontend (JavaScript Vanilla)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verificación Inicial de Autenticación
    verificarSesion();

    // 2. Evento de Login
    document.getElementById('formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            const response = await fetch('api.php?action=login', { method: 'POST', body: formData });
            const result = await response.json();
            
            if(result.status === 'success') {
                localStorage.setItem('usuario_actual', JSON.stringify(result.user));
                document.getElementById('formLogin').reset();
                verificarSesion(); // Cargar la interfaz de la app
            } else {
                mostrarToast(result.message, 'error', 'loginToast');
            }
        } catch (error) {
            mostrarToast('Error de conexión con el servidor', 'error', 'loginToast');
        }
    });

    // 3. Configuración Inicial del Formulario de Registro
    document.getElementById('fecha').valueAsDate = new Date();

    // 4. Eventos de búsqueda y filtrado
    document.getElementById('buscarCodigo').addEventListener('input', cargarDocumentos);
    document.getElementById('filtroDespacho').addEventListener('change', cargarDocumentos);
    
    // 5. Evento para registrar un nuevo documento
    document.getElementById('formRegistro').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            const response = await fetch('api.php?action=registrar_documento', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            mostrarToast(result.message, result.status, 'toast');
            
            if(result.status === 'success'){
                e.target.reset(); 
                document.getElementById('fecha').valueAsDate = new Date(); 
                cargarDocumentos(); 
            }
        } catch (error) {
            mostrarToast('Error de conexión con el servidor', 'error', 'toast');
        }
    });

    // 6. Funcionalidad de Modo Oscuro (Creatividad Adicional)
    const btnDarkMode = document.getElementById('btnDarkMode');
    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        btnDarkMode.textContent = '☀️';
    }

    btnDarkMode.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if(document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            btnDarkMode.textContent = '☀️';
        } else {
            localStorage.setItem('theme', 'light');
            btnDarkMode.textContent = '🌙';
        }
    });
});

/* =======================================================
   SISTEMA DE AUTENTICACIÓN
   ======================================================= */
function verificarSesion() {
    const usuarioStr = localStorage.getItem('usuario_actual');
    
    if(usuarioStr) {
        const usuario = JSON.parse(usuarioStr);
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appScreen').classList.remove('hidden');
        
        document.getElementById('nombreUsuarioActivo').innerHTML = `<strong>${usuario.nombre_completo}</strong> (${usuario.rol})`;
        
        // Solo cargar datos de DB si el usuario está logueado
        cargarDespachos();
        cargarDocumentos();
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('appScreen').classList.add('hidden');
    }
}

function cerrarSesion() {
    localStorage.removeItem('usuario_actual');
    verificarSesion();
}

/* =======================================================
   FUNCIONES CRUD PRINCIPALES
   ======================================================= */
async function cargarDespachos() {
    const res = await fetch('api.php?action=get_despachos');
    const despachos = await res.json();
    
    const selectForm = document.getElementById('despacho');
    const selectFiltro = document.getElementById('filtroDespacho');
    
    let options = '<option value="">Seleccione...</option>';
    despachos.forEach(d => {
        options += `<option value="${d.id}">${d.nombre}</option>`;
    });

    selectForm.innerHTML = options;
    selectFiltro.innerHTML = '<option value="">Todos los despachos</option>' + options;
}

async function cargarDocumentos() {
    const search = document.getElementById('buscarCodigo').value;
    const despacho = document.getElementById('filtroDespacho').value;
    
    const res = await fetch(`api.php?action=listar_documentos&search=${search}&despacho=${despacho}`);
    const documentos = await res.json();
    
    const tbody = document.querySelector('#tablaDocumentos tbody');
    tbody.innerHTML = '';

    documentos.forEach(doc => {
        let claseBadge = '';
        if(doc.estado === 'Pendiente de entrega') claseBadge = 'pendiente';
        else if(doc.estado === 'Cargo de envío') claseBadge = 'envio';
        else if(doc.estado === 'Cargo devuelto entregado') claseBadge = 'entregado';
        else claseBadge = 'notificado';

        let htmlEstado = `
            <select onchange="cambiarEstado(${doc.id}, this.value)" style="margin-bottom: 5px;">
                <option value="" disabled selected>Actualizar estado...</option>
                <option value="Cargo devuelto entregado">Marcar Entregado</option>
                <option value="No recepcionado (notificado)">Marcar No Recepcionado</option>
            </select>
        `;

        if(doc.estado === 'Pendiente de entrega') {
            htmlEstado = `<small style="display:block; margin-bottom:5px; color:#4b5563; font-weight:bold;">Pendiente de Guía</small>`;
        }

        let acciones = `
            <div style="display: flex; flex-direction: column;">
                ${htmlEstado}
                <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 5px; background-color: #6366f1;" onclick="verSeguimiento(${doc.id})">
                    🔎 Ver Seguimiento
                </button>
            </div>
        `;

        tbody.innerHTML += `
            <tr>
                <td><strong>${doc.codigo_unico}</strong></td>
                <td>${doc.tipo_documento}</td>
                <td>${doc.nombre_despacho}</td>
                <td><span class="badge ${claseBadge}">${doc.estado}</span></td>
                <td>${acciones}</td>
            </tr>
        `;
    });
}

async function generarGuia() {
    const id_despacho = document.getElementById('filtroDespacho').value;
    if(!id_despacho) {
        alert("Por favor, seleccione un despacho específico en el filtro superior antes de generar la guía.");
        return;
    }

    const formData = new FormData();
    formData.append('id_despacho', id_despacho);

    const response = await fetch('api.php?action=generar_guia', {
        method: 'POST',
        body: formData
    });
    const result = await response.json();
    
    alert(result.message); 
    if(result.status === 'success') {
        cargarDocumentos();
    }
}

async function cambiarEstado(id_documento, nuevo_estado) {
    if(!confirm(`¿Seguro que desea cambiar el estado a: ${nuevo_estado}?`)) {
        cargarDocumentos(); // Restablece el select
        return;
    }

    const formData = new FormData();
    formData.append('id_documento', id_documento);
    formData.append('nuevo_estado', nuevo_estado);

    const response = await fetch('api.php?action=actualizar_estado_documento', {
        method: 'POST',
        body: formData
    });
    const result = await response.json();
    
    mostrarToast(result.message, result.status, 'toast');
    cargarDocumentos();
}

/* =======================================================
   MODAL DE SEGUIMIENTO (TRAZABILIDAD)
   ======================================================= */
async function verSeguimiento(id_documento) {
    const res = await fetch(`api.php?action=ver_seguimiento&id_documento=${id_documento}`);
    const seguimiento = await res.json();
    
    const contenedor = document.getElementById('contenidoSeguimiento');
    contenedor.innerHTML = '';

    if(seguimiento.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; padding: 20px;">No hay registros de seguimiento para este documento.</p>';
    } else {
        seguimiento.forEach(paso => {
            const fecha = new Date(paso.fecha_hora).toLocaleString();
            contenedor.innerHTML += `
                <div class="timeline-item">
                    <div class="timeline-date">${fecha}</div>
                    <strong>Estado:</strong> <span class="badge" style="background:#e5e7eb; color:#1f2937;">${paso.estado}</span><br>
                    <small style="color: #4b5563; display:inline-block; margin-top:5px;">
                        <em>Detalle:</em> ${paso.descripcion}
                    </small>
                </div>
            `;
        });
    }

    document.getElementById('modalSeguimiento').classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('modalSeguimiento').classList.add('hidden');
}

/* =======================================================
   UTILIDADES
   ======================================================= */
function mostrarToast(mensaje, tipo, idElemento = 'toast') {
    const toast = document.getElementById(idElemento);
    toast.textContent = mensaje;
    toast.className = `toast ${tipo}`; 
    
    setTimeout(() => { 
        toast.classList.add('hidden'); 
    }, 3500);
}
