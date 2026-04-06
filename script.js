let peer;
let conn;
let logGlobal = []; // Memória do adm
let arquivosGlobal = [];

const usuarios = {
    "Moretigoldenboy": { senha: "goldenboy", id: "12012010" },
    "kyo": { senha: "777", id: "KYO" }
};

function log(msg, type = 'system') {
    const chat = document.getElementById("chat");
    chat.innerHTML += `<div class="${type}">${msg}</div>`;
    chat.scrollTop = chat.scrollHeight;
    // Salva para o painel do adm
    logGlobal.push({ hora: new Date().toLocaleTimeString(), msg, type });
}

function fazerLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;
    if (usuarios[u] && usuarios[u].senha === p) {
        document.getElementById('display-name').innerText = u;
        inicializarPeer(usuarios[u].id);
    } else { alert("Login incorreto!"); }
}

function entrarVisitante() {
    document.getElementById('display-name').innerText = "Visitante";
    inicializarPeer();
}

function inicializarPeer(idFixo = null) {
    peer = idFixo ? new Peer(idFixo) : new Peer();
    peer.on('open', id => {
        document.getElementById("myId").innerText = id;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
        if (id === "KYO-VIP") document.getElementById('admin-btn').style.display = 'block';
    });
    peer.on('connection', c => { conn = c; setup(); });
}

async function connect() {
    if (window.Notification && Notification.permission !== 'granted') await Notification.requestPermission();
    const id = document.getElementById("peerId").value;
    if (!id) return alert("Cole o ID do amigo!");
    conn = peer.connect(id);
    setup();
}

function setup() {
    if (!conn) return;
    conn.on('open', () => log("Conectado com sucesso!"));
    conn.on('data', data => {
        if (data.file) { receberArquivo(data); } 
        else { log("Amigo: " + data, "msg-peer"); tocarSom(); notificar(data); }
    });
}

function send() {
    const input = document.getElementById("msg");
    if (conn && conn.open && input.value) {
        conn.send(input.value);
        log("Você: " + input.value, "msg-me");
        input.value = "";
    }
}

// Arquivos
document.getElementById('file-input').onchange = e => {
    const file = e.target.files[0];
    if (file && conn && conn.open) {
        const reader = new FileReader();
        reader.onload = ev => {
            const data = { file: ev.target.result, fileName: file.name, fileType: file.type };
            conn.send(data);
            log("Você enviou um arquivo: " + file.name, "msg-me");
            arquivosGlobal.push(data);
        };
        reader.readAsArrayBuffer(file);
    }
};

function receberArquivo(data) {
    const blob = new Blob([data.file], { type: data.fileType });
    const url = URL.createObjectURL(blob);
    arquivosGlobal.push({ ...data, url });
    if (data.fileType.startsWith('image/')) {
        log(`Amigo: <br><img src="${url}" style="max-width:100%; border-radius:5px;">`, "msg-peer");
    } else {
        log(`Amigo enviou PDF/Arquivo: <a href="${url}" download="${data.fileName}">${data.fileName}</a>`, "msg-peer");
    }
}

// Funções do Painel do adm
function abrirPaineladm() {
    const logs = document.getElementById('logs-adm');
    const grid = document.getElementById('grid-adm');
    logs.innerHTML = logGlobal.map(m => `<div>[${m.hora}] ${m.msg}</div>`).join('');
    grid.innerHTML = arquivosGlobal.map(a => `
        <div class="card-arquivo">
            <small>${a.fileName}</small><br>
            <a href="${URL.createObjectURL(new Blob([a.file]))}" download="${a.fileName}">Baixar</a>
        </div>`).join('');
    document.getElementById('painel-kyo').style.display = 'block';
}

function fecharPainel() { document.getElementById('painel-kyo').style.display = 'none'; }
function tocarSom() { document.getElementById("notifSound").play().catch(() => {}); }
function notificar(m) { if (document.hidden) new Notification("Kyo Chat", { body: m }); }