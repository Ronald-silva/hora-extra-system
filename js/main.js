firebase.initializeApp(firebaseConfig);
console.log("Firebase inicializado:", firebase.app().name);

// Importe a configuração do Firebase
import { firebaseConfig } from './firebase-config.js';

// Inicialize o Firebase
firebase.initializeApp(firebaseConfig);

// Referências para serviços do Firebase
const db = firebase.firestore();
const storage = firebase.storage();

// Referências para elementos DOM
const cpfInput = document.getElementById('cpf');
const locationInput = document.getElementById('location');
const videoElement = document.getElementById('videoElement');
const historyTable = document.getElementById('historyTable').getElementsByTagName('tbody')[0];
const checkInButton = document.getElementById('checkIn');
const checkOutButton = document.getElementById('checkOut');

// Função para validar CPF
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g,'');	
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    cpf = cpf.split('').map(el => +el);
    const rest = (count) => (cpf.slice(0, count-12).reduce((soma, el, index) => (soma + el * (count-index)), 0) * 10) % 11 % 10;
    return rest(10) === cpf[9] && rest(11) === cpf[10];
}

// Função para inicializar a câmera
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        return true;
    } catch (error) {
        console.error("Erro ao acessar a câmera:", error);
        alert("Não foi possível acessar a câmera. Por favor, verifique as permissões.");
        return false;
    }
}

// Função para tirar foto
function takePhoto() {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        canvas.getContext('2d').drawImage(videoElement, 0, 0);
        canvas.toBlob(resolve, 'image/jpeg');
    });
}

// Função para registrar ponto
async function registerTime(type) {
    const cpf = cpfInput.value.trim();
    const location = locationInput.value.trim();

    if (!cpf || !location) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    if (!validarCPF(cpf)) {
        alert("Por favor, insira um CPF válido.");
        return;
    }

    console.log(`Iniciando registro de ${type} para CPF: ${cpf}`);

    if (!await initCamera()) return;

    alert("Câmera ativada. Por favor, posicione-se para a foto.");

    setTimeout(async () => {
        try {
            const photoBlob = await takePhoto();
            const now = new Date();
            
            // Salvar foto no Firebase Storage
            const photoRef = storage.ref(`photos/${cpf}_${now.getTime()}.jpg`);
            await photoRef.put(photoBlob);
            const photoUrl = await photoRef.getDownloadURL();

            // Salvar registro no Firestore
            await db.collection("timeRecords").add({
                cpf: cpf,
                location: location,
                type: type,
                timestamp: now,
                photoUrl: photoUrl
            });

            console.log(`${type} registrado com sucesso para CPF: ${cpf}`);

            // Atualizar a tabela local
            updateHistoryTable(cpf, location, type, now);

            resetInterface();
            alert(`${type} registrado com sucesso!`);
        } catch (error) {
            console.error("Erro ao registrar ponto:", error);
            alert("Ocorreu um erro ao registrar o ponto. Por favor, tente novamente.");
        } finally {
            // Parar a câmera
            if (videoElement.srcObject) {
                videoElement.srcObject.getTracks().forEach(track => track.stop());
                videoElement.srcObject = null;
            }
        }
    }, 3000);
}

// Função para atualizar a tabela de histórico
function updateHistoryTable(cpf, location, type, timestamp) {
    const row = historyTable.insertRow(0);
    row.insertCell(0).textContent = timestamp.toLocaleDateString();
    row.insertCell(1).textContent = cpf;
    row.insertCell(2).textContent = location;
    row.insertCell(3).textContent = type;
    row.insertCell(4).textContent = timestamp.toLocaleTimeString();
}

// Função para resetar a interface
function resetInterface() {
    cpfInput.value = '';
    locationInput.value = '';
    // Adicione aqui qualquer outro elemento da interface que precise ser resetado
}

// Carregar histórico do Firestore
async function loadHistory() {
    try {
        historyTable.innerHTML = ''; // Limpa a tabela antes de carregar
        const snapshot = await db.collection("timeRecords").orderBy("timestamp", "desc").limit(10).get();
        snapshot.forEach(doc => {
            const data = doc.data();
            updateHistoryTable(data.cpf, data.location, data.type, data.timestamp.toDate());
        });
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        alert("Não foi possível carregar o histórico. Por favor, tente novamente mais tarde.");
    }
}

// Carregar histórico ao iniciar a página
document.addEventListener('DOMContentLoaded', loadHistory);

// Event listeners
checkInButton.addEventListener('click', () => registerTime('Entrada'));
checkOutButton.addEventListener('click', () => registerTime('Saída'));

// Adicionar event listener para recarregar histórico periodicamente (a cada 5 minutos, por exemplo)
setInterval(loadHistory, 300000);