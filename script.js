/* ═══════════════════════════════════════════════
   ChatPrivadoDG — LÓGICA DE MULTI-CONEXÃO
═══════════════════════════════════════════════ */

let peer;
let conexoesAtivas = {}; 
let usuarioAtual = null;

// Banco de dados local
let dbLogs = JSON.parse(localStorage.getItem('chatprivadodg_logs')) || {};

const USUARIOS_PADRAO = {
    "admin": { senha: "123", permissao: "admin" },
    "Davi": { senha: "2907", permissao: "usuario" },
    "Juju": { senha: "2907", permissao: "usuario" }
};

/* LOGIN */
function fazerLogin() {
    const login = document.getElementById('user-input').value.trim();
    const senha = document.getElementById('pass-input').value;
    const usuarios = { ...USUARIOS_PADRAO, ...JSON.parse(localStorage.getItem('chatprivadodg_usuarios') || '{}') };
    
    const user = usuarios[login];
    if (user && user.senha === senha) {
        usuarioAtual = { login, permissao: user.permissao };
        const idPeer = user.permissao === 'admin' ? 'ADMIN-SERVER' : login.toUpperCase();
        iniciarPeer(idPeer, login);
    } else {
        alert("Acesso negado.");
    }
}

function mostrarFormVisitante() {
    document.getElementById('box-principal').style.display = 'none';
    document.getElementById('box-visitante').style.display = 'block';
}

function finalizarCadastroVisitante() {
    const nome = document.getElementById('visitante-nome').value.trim();
    const id = document.getElementById('visitante-id').value.trim().toUpperCase();
    if (nome && id) {
        usuarioAtual = { login: nome, permissao: 'visitante' };
        iniciarPeer(id, nome);
    }
}

/* PEER ENGINE */
function iniciarPeer(idFixo, nome) {
    peer = new Peer(idFixo);

    peer.on('open', id => {
        document.getElementById('myId').innerText = id;
        document.getElementById('display-name').innerText = nome;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        if (usuarioAtual.permissao === 'admin') document.getElementById('admin-btn').style.display = 'block';
    });

    peer.on('connection', conn => configurarConexao(conn));
    
    peer.on('call', call => {
        call.answer();
        call.on('stream', stream => {
            const video = document.getElementById('remote-video');
            document.getElementById('video-grid').style.display = 'block';
            video.srcObject = stream;
        });
    });
}

function conectar() {
    const idDestino = document.getElementById('peerId').value.trim().toUpperCase();
    if (idDestino && !conexoesAtivas[idDestino]) {
        const conn = peer.connect(idDestino);
        configurarConexao(conn);
    }
}

function configurarConexao(c) {
    c.on('open', () => {
        conexoesAtivas[c.peer] = c;
        document.getElementById('welcome-screen').style.display = 'none';
        criarInterfaceChat(c.peer);
    });

    c.on('data', dados => {
        if (dados.arquivo) {
            exibirArquivo(c.peer, dados);
        } else {
            renderizarMensagem(c.peer, dados, "msg-peer");
        }
        registrarLog(c.peer, "Recebido", dados);
    });
}

/* INTERFACE DINÂMICA */
function criarInterfaceChat(peerId) {
    if (document.getElementById(`win-${peerId}`)) return;

    const wrapper = document.getElementById('multi-chat-wrapper');
    const html = `
        <div class="chat-window" id="win-${peerId}">
            <div class="chat-header">
                <span>${peerId}</span>
                <div>
                    <button class="btn-icon-chat" onclick="compartilharTela('${peerId}')">🖥️</button>
                    <button class="btn-icon-chat" onclick="fecharChat('${peerId}')">✕</button>
                </div>
            </div>
            <div class="chat-messages" id="msgs-${peerId}"></div>
            <div class="chat-input-area">
                <input type="text" id="in-${peerId}" placeholder="Mensagem..." onkeydown="if(event.key==='Enter') enviarPara('${peerId}')">
                <button class="btn-icon-chat" onclick="enviarPara('${peerId}')">➤</button>
            </div>
        </div>
    `;
    wrapper.insertAdjacentHTML('beforeend', html);
}

function enviarPara(peerId) {
    const input = document.getElementById(`in-${peerId}`);
    const msg = input.value.trim();
    const conn = conexoesAtivas[peerId];

    if (msg && conn) {
        conn.send(msg);
        renderizarMensagem(peerId, msg, "msg-me");
        registrarLog(peerId, "Enviado", msg);
        input.value = "";
    }
}

function renderizarMensagem(peerId, texto, classe) {
    const box = document.getElementById(`msgs-${peerId}`);
    const div = document.createElement('div');
    div.className = `msg ${classe}`;
    div.innerText = texto;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

async function compartilharTela(peerId) {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        peer.call(peerId, stream);
    } catch (e) { console.error(e); }
}

function fecharChat(peerId) {
    document.getElementById(`win-${peerId}`).remove();
    if (conexoesAtivas[peerId]) conexoesAtivas[peerId].close();
    delete conexoesAtivas[peerId];
}

function registrarLog(id, tipo, txt) {
    if (!dbLogs[id]) dbLogs[id] = [];
    dbLogs[id].push({ h: new Date().toLocaleTimeString(), tipo, txt });
    localStorage.setItem('chatprivadodg_logs', JSON.stringify(dbLogs));
}

function fecharPainel() { document.getElementById('painel-admin').style.display = 'none'; }
function abrirPainel() { document.getElementById('painel-admin').style.display = 'flex'; }