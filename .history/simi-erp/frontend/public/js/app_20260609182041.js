const API_PRODUCTOS = '/api/productos';
const API_AUTH = '/api/auth';
let tempToken = null;

const seccionAuth = document.getElementById('seccionAuth');
const seccionDashboard = document.getElementById('seccionDashboard');
const btnCerrarSesion = document.getElementById('btnCerrarSesion');
const msgAuth = document.getElementById('msgAuth');

function getToken() { return localStorage.getItem('simi_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }; }
function mostrarPaso(id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('activo'));
    document.getElementById(id).classList.add('activo');
}
function mostrarErrorAuth(texto) {
    msgAuth.textContent = texto;
    msgAuth.className = 'error';
    msgAuth.style.display = 'block';
}

window.addEventListener('DOMContentLoaded', () => { if (getToken()) mostrarDashboard(); });

document.getElementById('btnLogin').addEventListener('click', async () => {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!username || !password) return mostrarErrorAuth('Completa los datos');

    try {
        const res = await fetch(`${API_AUTH}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) return mostrarErrorAuth(data.error);

        tempToken = data.tempToken;

        if (!data.mfaActivo) {
            const resQr = await fetch(`${API_AUTH}/mfa/setup`, { headers: { 'Authorization': `Bearer ${tempToken}` } });
            const dataQr = await resQr.json();
            document.getElementById('qrImg').src = dataQr.qrUrl;
            mostrarPaso('pasoMfaSetup');
        } else {
            mostrarPaso('pasoMfaVerify');
        }
    } catch (err) { mostrarErrorAuth('Error de conexión'); }
});

document.getElementById('btnActivarMfa').addEventListener('click', async () => {
    const codigo = document.getElementById('codigoSetup').value.trim();
    const res = await fetch(`${API_AUTH}/mfa/activar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tempToken}` },
        body: JSON.stringify({ codigo })
    });
    const data = await res.json();
    if (res.ok) { localStorage.setItem('simi_token', data.token); mostrarDashboard(); } 
    else { alert('Código incorrecto'); }
});

document.getElementById('btnVerificarMfa').addEventListener('click', async () => {
    const codigo = document.getElementById('codigoVerify').value.trim();
    const res = await fetch(`${API_AUTH}/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tempToken}` },
        body: JSON.stringify({ codigo })
    });
    const data = await res.json();
    if (res.ok) { localStorage.setItem('simi_token', data.token); mostrarDashboard(); } 
    else { alert('Código incorrecto'); }
});

function mostrarDashboard() {
    seccionAuth.style.display = 'none';
    seccionDashboard.style.display = 'block';
    btnCerrarSesion.style.display = 'block';
    cargarProductos();
}

btnCerrarSesion.addEventListener('click', () => {
    localStorage.removeItem('simi_token');
    location.reload();
});

// ================= LÓGICA DE PRODUCTOS =================
const inputNombre = document.getElementById('nombre');
const inputCategoria = document.getElementById('categoria');
const inputPrecio = document.getElementById('precio');
const inputStock = document.getElementById('stock');
const inputDescripcion = document.getElementById('descripcion');
const mensajeEl = document.getElementById('mensaje');
const loadingEl = document.getElementById('loading');
const tbodyEl = document.getElementById('tbodyProductos');

function mostrarMensaje(texto, tipo) {
    mensajeEl.textContent = texto;
    mensajeEl.className = tipo;
    mensajeEl.style.display = 'block';
    setTimeout(() => { mensajeEl.style.display = 'none'; }, 4000);
}

function verificarAccesoCondicional(res) {
    if (res.status === 401 || res.status === 403) {
        alert("Tu sesión ha expirado o no tienes acceso. Iniciando sesión nuevamente.");
        localStorage.removeItem('simi_token');
        location.reload();
        throw new Error("Acceso denegado");
    }
}

async function cargarProductos() {
    loadingEl.style.display = 'block';
    tbodyEl.innerHTML = '';
    try {
        const respuesta = await fetch(API_PRODUCTOS, { headers: authHeaders() });
        verificarAccesoCondicional(respuesta);
        const productos = await respuesta.json();
        productos.forEach(producto => renderFila(producto));
        loadingEl.style.display = 'none';
    } catch (err) {}
}

function renderFila(producto) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${producto.id}</td>
      <td><strong>${producto.nombre}</strong><br><small>${producto.descripcion || ''}</small></td>
      <td>${producto.categoria}</td>
      <td>$${Number(producto.precio).toLocaleString('es-CL')}</td>
      <td>${producto.stock}</td>
      <td><button class="btn-del" data-id="${producto.id}">Eliminar</button></td>
    `;
    tr.querySelector('.btn-del').addEventListener('click', () => eliminarProducto(producto.id));
    tbodyEl.appendChild(tr);
}

document.getElementById('btnGuardar').addEventListener('click', async () => {
    const cuerpo = {
        nombre: inputNombre.value.trim(),
        descripcion: inputDescripcion.value.trim(),
        precio: parseFloat(inputPrecio.value),
        stock: parseInt(inputStock.value || '0'),
        categoria: inputCategoria.value
    };
    if (!cuerpo.nombre || isNaN(cuerpo.precio)) return mostrarMensaje('Nombre y precio obligatorios', 'error');

    const respuesta = await fetch(API_PRODUCTOS, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(cuerpo),
    });
    verificarAccesoCondicional(respuesta);
    if (respuesta.ok) { mostrarMensaje('Producto guardado', 'ok'); cargarProductos(); }
});

async function eliminarProducto(id) {
    if (!confirm('¿Eliminar producto?')) return;
    const respuesta = await fetch(`${API_PRODUCTOS}/${id}`, { method: 'DELETE', headers: authHeaders() });
    verificarAccesoCondicional(respuesta);
    if (respuesta.ok) cargarProductos();
}