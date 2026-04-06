let peer;
let conn;

// Usuários com IDs fixos
const usuariosCadastrados = {
    "admin": { senha: "123", id: "BOSS-77" },
    "kyo": { senha: "777", id: "KYO-VIP" }
};

function log(msg, type = 'system') {
    const chat = document.getElementById("chat");
    chat.innerHTML += `<div class="${type}">${msg}</div>`;
    chat.scrollTop = chat.scrollHeight;
}

// Lógica de Login
function fazerLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;

    if (usuariosCadastrados[u] && usuariosCadastrados[u].senha === p) {
        document.getElementById('display-name').innerText = u;
        inicializarPeer(usuariosCadastrados[u].id);
    } else {
        alert("Usuário ou senha incorretos!");
    }
}

function entrarVisitante() {
    document.getElementById('display-name').innerText = "Visitante";
    inicializarPeer(); // Gera ID aleatório
}

function inicializarPeer(idFixo = null) {
    peer = idFixo ? new Peer(idFixo) : new Peer();

    peer.on('open', id => {
        document.getElementById("myId").innerText = id;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('chat-container').style.display = 'block';
    });

    peer.on('connection', connection => {
        conn = connection;
        setup();
    });
}

async function connect() {
    if (window.Notification && Notification.permission !== 'granted') {
        await Notification.requestPermission();
    }
    const id = document.getElementById("peerId").value;
    if (!id) return alert("Digite o ID!");
    conn = peer.connect(id);
    setup();
}

function setup() {
    if (!conn) return;
    conn.on('open', () => log("Conectado com sucesso!"));
    
    conn.on('data', data => {
        if (data.file) {
            receberArquivo(data);
        } else {
            log("Amigo: " + data, "msg-peer");
            notificar(data);
        }
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

// Arquivos e PDFs
document.getElementById('file-input').onchange = function(e) {
    const file = e.target.files[0];
    if (file && conn && conn.open) {
        const reader = new FileReader();
        reader.onload = function(event) {
            conn.send({
                file: event.target.result,
                fileName: file.name,
                fileType: file.type
            });
            log("Você enviou: " + file.name, "msg-me");
        };
        reader.readAsArrayBuffer(file);
    }
};

function receberArquivo(data) {
    const blob = new Blob([data.file], { type: data.fileType });
    const url = URL.createObjectURL(blob);
    if (data.fileType.startsWith('image/')) {
        log(`Amigo enviou imagem: <br><img src="${url}" style="max-width:100%; margin-top:5px;">`, "msg-peer");
    } else {
        log(`Amigo enviou arquivo: <a href="${url}" download="${data.fileName}">${data.fileName}</a>`, "msg-peer");
    }
}

function notificar(msg) {
    document.getElementById("notifSound").play().catch(() => {});
    if (document.hidden && Notification.permission === 'granted') {
        new Notification("Novo Alerta", { body: msg });
    }
}