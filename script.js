/* ═══════════════════════════════════════════════
   VARIÁVEIS GLOBAIS
═══════════════════════════════════════════════ */
let peer;
let conn;
let currentCall; // Para gerenciar a chamada de vídeo/tela
let db = JSON.parse(localStorage.getItem('chat_privado_db')) || {};
const credenciais = { "admin": "123" };

/* ═══════════════════════════════════════════════
   LOGIN E TELAS (SEM ALTERAÇÕES)
═══════════════════════════════════════════════ */
function fazerLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;
    if (credenciais[u] && credenciais[u] === p) {
        document.getElementById('admin-btn').style.display = 'block';
        startPeer("ADMIN-SERVER", "Administrador");
    } else { alert("Acesso negado."); }
}
function prepararVisitante() {
    document.getElementById('box-principal').style.display = 'none';
    document.getElementById('box-visitante').style.display = 'block';
}
function voltarLogin() {
    document.getElementById('box-principal').style.display = 'block';
    document.getElementById('box-visitante').style.display = 'none';
}
function finalizarCadastroVisitante() {
    const nome = document.getElementById('visitante-nome').value.trim();
    const idSugerido = document.getElementById('visitante-id').value.trim().toUpperCase();
    if (!nome || !idSugerido) { alert("Nome e ID obrigatórios."); return; }
    if (db[idSugerido]) { alert("ID já existe."); return; }
    startPeer(idSugerido, nome);
}

/* ═══════════════════════════════════════════════
   CONEXÃO E PEERJS
═══════════════════════════════════════════════ */
function startPeer(idFixo, nomeExibicao) {
    peer = new Peer(idFixo);
    peer.on('open', id => {
        document.getElementById('myId').innerText = id;
        document.getElementById('display-name').innerText = nomeExibicao;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
    });

    peer.on('connection', c => {
        conn = c;
        configurarConexao();
    });

    // Escuta por chamadas de vídeo (Compartilhamento de Tela)
    peer.on('call', call => {
        currentCall = call;
        call.answer(); // Atende automaticamente para ver a tela
        call.on('stream', remoteStream => {
            showVideo(remoteStream);
        });
    });
}

function connect() {
    const id = document.getElementById('peerId').value.trim().toUpperCase();
    if (!id) return;
    conn = peer.connect(id);
    configurarConexao();
}

function configurarConexao() {
    conn.on('open', () => {
        renderizarChat(`Conexão estabelecida com: ${conn.peer}`, "system-msg");
    });
    conn.off('data'); 
    conn.on('data', data => {
        if (data.file) {
            receberArquivo(data);
        } else {
            registrarMensagem(conn.peer, "Recebido", data);
            renderizarChat(data, "msg-peer");
        }
    });
}

/* ═══════════════════════════════════════════════
   FUNCIONALIDADE: ENVIAR ARQUIVOS
═══════════════════════════════════════════════ */
function sendFile(input) {
    const file = input.files[0];
    if (!file || !conn) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const fileData = {
            file: true,
            fileName: file.name,
            fileType: file.type,
            blob: e.target.result
        };
        conn.send(fileData);
        registrarMensagem(conn.peer, "Enviado", `[Arquivo: ${file.name}]`);
        renderizarChat(`Arquivo enviado: ${file.name}`, "msg-me");
    };
    reader.readAsDataURL(file);
}

function receberArquivo(data) {
    const link = `<a href="${data.blob}" download="${data.fileName}" class="msg-file">📁 Baixar: ${data.fileName}</a>`;
    registrarMensagem(conn.peer, "Recebido", `[Arquivo: ${data.fileName}]`);
    renderizarChat(link, "msg-peer");
}

/* ═══════════════════════════════════════════════
   FUNCIONALIDADE: COMPARTILHAR TELA
═══════════════════════════════════════════════ */
async function toggleScreenShare() {
    if (!conn) { alert("Conecte-se a alguém primeiro."); return; }
    
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        currentCall = peer.call(conn.peer, stream);
        
        // Esconde o vídeo para quem compartilha (opcional) ou mostra preview
        renderizarChat("Você iniciou o compartilhamento de tela.", "system-msg");
        
        stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (err) {
        console.error("Erro ao compartilhar tela:", err);
    }
}

function showVideo(stream) {
    const grid = document.getElementById('video-grid');
    const video = document.getElementById('remote-video');
    grid.style.display = 'block';
    video.srcObject = stream;
}

function stopScreenShare() {
    const grid = document.getElementById('video-grid');
    grid.style.display = 'none';
    if (currentCall) currentCall.close();
}

/* ═══════════════════════════════════════════════
   CHAT E ADMIN (MANTIDOS)
═══════════════════════════════════════════════ */
function send() {
    const msgInput = document.getElementById('msg');
    const msg = msgInput.value.trim();
    if (conn && conn.open && msg) {
        conn.send(msg);
        registrarMensagem(conn.peer, "Enviado", msg);
        renderizarChat(msg, "msg-me");
        msgInput.value = "";
    }
}

function renderizarChat(msg, classe) {
    const chatBox = document.getElementById('chat');
    const div = document.createElement('div');
    div.className = classe;
    if (msg.includes('<a')) div.innerHTML = msg; else div.innerText = msg;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Funções Admin (registrarMensagem, abrirPainel, etc) seguem iguais...
function registrarMensagem(peerId, tipo, texto) {
    if (!db[peerId]) db[peerId] = [];
    db[peerId].push({ time: new Date().toLocaleTimeString(), sender: tipo, body: texto });
    localStorage.setItem('chat_privado_db', JSON.stringify(db));
    if (document.getElementById('painel-admin').style.display === 'flex') atualizarListaAdmin();
}
function abrirPainel() { document.getElementById('painel-admin').style.display = 'flex'; atualizarListaAdmin(); }
function fecharPainel() { document.getElementById('painel-admin').style.display = 'none'; }
function atualizarListaAdmin() {
    const lista = document.getElementById('lista-conversas');
    lista.innerHTML = "";
    Object.keys(db).forEach(id => {
        const div = document.createElement('div');
        div.className = 'conversa-item';
        div.innerHTML = `<span>ID: ${id}</span> <button class="del-btn" onclick="apagarConversa('${id}')">🗑️</button>`;
        div.onclick = (e) => { if(e.target.tagName !== 'BUTTON') verConversa(id); };
        lista.appendChild(div);
    });
}
function verConversa(id) {
    document.getElementById('id-conversa-ativa').innerText = id;
    const view = document.getElementById('logs-adm-detalhado');
    view.innerHTML = "";
    db[id].forEach((m, idx) => {
        view.innerHTML += `<div class="admin-msg-linha"><span><small>${m.time}</small> <b>${m.sender}:</b> ${m.body}</span></div>`;
    });
}
function apagarConversa(id) {
    if(confirm(`Remover logs de ${id}?`)) {
        delete db[id];
        localStorage.setItem('chat_privado_db', JSON.stringify(db));
        atualizarListaAdmin();
    }
}
function limparTudo() { if(confirm("Limpar tudo?")) { db = {}; localStorage.clear(); atualizarListaAdmin(); } }