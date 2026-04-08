let peer;
let conn;
let logGlobal = [];
let arquivosGlobal = [];

// Base de usuários (ajustada para remover referências externas)
const usuarios = {
    "admin": { senha: "123", id: "ADMIN-PRIVADO", cargo: "admin" },
    "operador": { senha: "777", id: "OP-01", cargo: "membro" }
};

function fazerLogin() {
    const user = document.getElementById('user-input').value;
    const pass = document.getElementById('pass-input').value;

    if (usuarios[user] && usuarios[user].senha === pass) {
        const dadosUser = usuarios[user];
        document.getElementById('display-name').innerText = user;
        
        if (dadosUser.cargo === "admin") {
            document.getElementById('admin-btn').style.display = 'block';
        }
        
        inicializarPeer(dadosUser.id);
    } else {
        alert("Acesso negado: Credenciais inválidas.");
    }
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
    });

    peer.on('connection', c => {
        conn = c;
        setup();
    });
}

async function connect() {
    const id = document.getElementById("peerId").value;
    if (!id) return alert("Digite o ID do destinatário!");
    conn = peer.connect(id);
    setup();
}

function setup() {
    if (!conn) return;
    conn.on('open', () => {
        log("Sistema: Conexão Estabelecida!", "msg-peer");
    });
    
    conn.on('data', data => {
        if (data.file) {
            receberArquivo(data);
        } else {
            log(data, "msg-peer");
            tocarSom();
        }
    });
}

function log(msg, type) {
    const chat = document.getElementById("chat");
    const tempo = new Date().toLocaleTimeString();
    
    // Se a mensagem for HTML (imagem), insere como HTML, senão como texto
    const div = document.createElement('div');
    div.className = type;
    if(msg.includes('<img') || msg.includes('<a')) {
        div.innerHTML = msg;
    } else {
        div.innerText = msg;
    }
    
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    
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

// Lógica de arquivos
document.getElementById('file-input').onchange = e => {
    const file = e.target.files[0];
    if (file && conn && conn.open) {
        const reader = new FileReader();
        reader.onload = ev => {
            const arquivo = { file: ev.target.result, fileName: file.name, fileType: file.type };
            conn.send(arquivo);
            log("Arquivo enviado: " + file.name, "msg-me");
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

function abrirPainel() {
    const logs = document.getElementById('logs-adm');
    const grid = document.getElementById('grid-adm');
    
    logs.innerHTML = logGlobal.map(m => `<div>[${m.tempo}] ${m.msg}</div>`).join('');
    
    grid.innerHTML = arquivosGlobal.map(a => {
        const url = a.url || URL.createObjectURL(new Blob([a.file], {type: a.fileType}));
        return `<div class="card-arquivo"><small>${a.fileName}</small><br><a href="${url}" download="${a.fileName}">Download</a></div>`;
    }).join('');
    
    document.getElementById('painel-admin').style.display = 'flex';
}

function fecharPainel() { document.getElementById('painel-admin').style.display = 'none'; }
function tocarSom() { document.getElementById("notifSound").play().catch(() => {}); }