let peer;
let conn;
let logGlobal = [];
let arquivosGlobal = [];

// --- CONFIGURAÇÃO DE USUÁRIOS E ADMS ---
const usuarios = {
    "kyo": { senha: "777", id: "KYO-VIP", cargo: "admin" },
    "admin": { senha: "123", id: "ADMIN-01", cargo: "admin" },
    "amigo": { senha: "999", id: "USER-02", cargo: "membro" } // Este não vê o painel
};

function fazerLogin() {
    const user = document.getElementById('user-input').value;
    const pass = document.getElementById('pass-input').value;

    if (usuarios[user] && usuarios[user].senha === pass) {
        const dadosUser = usuarios[user];
        document.getElementById('display-name').innerText = user;
        
        // Se for admin, mostramos o botão
        if (dadosUser.cargo === "admin") {
            document.getElementById('admin-btn').style.display = 'block';
        }
        
        inicializarPeer(dadosUser.id);
    } else {
        alert("Usuário ou senha incorretos!");
    }
}

function entrarVisitante() {
    document.getElementById('display-name').innerText = "Visitante";
    inicializarPeer(); // Gera ID aleatório, sem cargo de admin
}

function inicializarPeer(idFixo = null) {
    peer = idFixo ? new Peer(idFixo) : new Peer();

    peer.on('open', id => {
        document.getElementById("myId").innerText = id;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
    });

    peer.on('connection', c => {
        conn = c;
        setup();
    });
}

// --- FUNÇÕES DE CONEXÃO ---
async function connect() {
    if (window.Notification && Notification.permission !== 'granted') await Notification.requestPermission();
    const id = document.getElementById("peerId").value;
    if (!id) return alert("Digite o ID do amigo!");
    conn = peer.connect(id);
    setup();
}

function setup() {
    if (!conn) return;
    conn.on('open', () => {
        log("Sistema: Conexão Estabelecida!", "msg-me");
    });
    
    conn.on('data', data => {
        if (data.file) {
            receberArquivo(data);
        } else {
            log(data, "msg-peer");
            tocarSom();
            notificar(data);
        }
    });
}

function log(msg, type) {
    const chat = document.getElementById("chat");
    const tempo = new Date().toLocaleTimeString();
    chat.innerHTML += `<div class="${type}">${msg}</div>`;
    chat.scrollTop = chat.scrollHeight;
    
    // Salva tudo para os Admins verem no painel
    logGlobal.push({ tempo, msg, type });
}

function send() {
    const input = document.getElementById("msg");
    if (conn && conn.open && input.value) {
        conn.send(input.value);
        log(input.value, "msg-me");
        input.value = "";
    }
}

// --- ARQUIVOS E IMAGENS ---
document.getElementById('file-input').onchange = e => {
    const file = e.target.files[0];
    if (file && conn && conn.open) {
        const reader = new FileReader();
        reader.onload = ev => {
            const arquivo = { file: ev.target.result, fileName: file.name, fileType: file.type };
            conn.send(arquivo);
            log("Você enviou: " + file.name, "msg-me");
            arquivosGlobal.push(arquivo);
        };
        reader.readAsArrayBuffer(file);
    }
};

function receberArquivo(data) {
    const blob = new Blob([data.file], { type: data.fileType });
    const url = URL.createObjectURL(blob);
    arquivosGlobal.push({ ...data, url });
    
    if (data.fileType.startsWith('image/')) {
        log(`<img src="${url}" style="max-width:100%; border-radius:5px;">`, "msg-peer");
    } else {
        log(`Arquivo: <a href="${url}" download="${data.fileName}">${data.fileName}</a>`, "msg-peer");
    }
}

// --- PAINEL DO ADMIN ---
function abrirPainelKyo() {
    const logs = document.getElementById('logs-adm');
    const grid = document.getElementById('grid-adm');
    
    logs.innerHTML = logGlobal.map(m => `<div><small>${m.tempo}</small> <b>${m.type}:</b> ${m.msg}</div>`).join('');
    
    grid.innerHTML = arquivosGlobal.map(a => {
        const url = a.url || URL.createObjectURL(new Blob([a.file], {type: a.fileType}));
        return `
        <div class="card-arquivo">
            <small>${a.fileName}</small><br>
            <a href="${url}" download="${a.fileName}">Baixar</a>
        </div>`;
    }).join('');
    
    document.getElementById('painel-kyo').style.display = 'block';
}

function fecharPainel() { document.getElementById('painel-kyo').style.display = 'none'; }
function tocarSom() { document.getElementById("notifSound").play().catch(() => {}); }
function notificar(m) { if (document.hidden) new Notification("Kyo Chat", { body: m }); }