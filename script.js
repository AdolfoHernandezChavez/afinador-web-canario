// CONFIGURACIÓN DE DATOS
const instruments = {
    guitarra: [
        { note: 'E2', freq: 82.41 },
        { note: 'A2', freq: 110.00 },
        { note: 'D3', freq: 146.83 },
        { note: 'G3', freq: 196.00 },
        { note: 'B3', freq: 246.94 },
        { note: 'E4', freq: 329.63 }
    ],
    bajo: [
        { note: 'E1', freq: 41.20 },
        { note: 'A1', freq: 55.00 },
        { note: 'D2', freq: 73.42 },
        { note: 'G2', freq: 98.00 }
    ],
    timple: [
        { note: 'D5', freq: 587.33 }, // 1ª Cuerda (La de abajo del todo)
        { note: 'A4', freq: 440.00 }, // 2ª Cuerda
        { note: 'E4', freq: 329.63 }, // 3ª Cuerda
        { note: 'C5', freq: 523.25 }, // 4ª Cuerda (¡Esta es aguda!)
        { note: 'G4', freq: 392.00 }  // 5ª Cuerda (La de arriba/camellito)
    ]
};

let currentInstrument = 'guitarra';
let targetFreq = instruments['guitarra'][0].freq;
let audioContext = null;
let analyser = null;
let mediaStreamSource = null;
let isRunning = false;
let smoothedPitch = 0; // Aquí guardaremos el valor "suavizado"
const smoothingAlpha = 0.15; // Valor entre 0 y 1. 
// 0.05 = Muy lento/suave (como un barco)
// 0.90 = Muy rápido/nervioso (como una mosca)

// Elementos del DOM
const needle = document.getElementById('needle');
const noteDisplay = document.getElementById('note-display');
const freqDisplay = document.getElementById('freq-display');
const statusMsg = document.getElementById('status-msg');
const stringContainer = document.getElementById('string-container');
const startBtn = document.getElementById('start-btn');
const instrumentSelect = document.getElementById('instrument-select');

// INICIALIZACIÓN DE UI
function renderStrings() {
    stringContainer.innerHTML = '';
    instruments[currentInstrument].forEach((string, index) => {
        const btn = document.createElement('button');
        btn.className = 'string-btn';
        btn.textContent = string.note.charAt(0);
        btn.onclick = () => selectString(index, string.freq);
        if(string.freq === targetFreq) btn.classList.add('active');
        stringContainer.appendChild(btn);
    });
}

function selectString(index, freq) {
    targetFreq = freq;
    const buttons = document.querySelectorAll('.string-btn');
    buttons.forEach(b => b.classList.remove('active'));
    buttons[index].classList.add('active');
    
    noteDisplay.textContent = instruments[currentInstrument][index].note;
    statusMsg.textContent = "Escuchando...";
    needle.style.transform = `translateX(-50%) rotate(0deg)`;
}

instrumentSelect.addEventListener('change', (e) => {
    currentInstrument = e.target.value;
    targetFreq = instruments[currentInstrument][0].freq; 
    renderStrings();
    selectString(0, targetFreq);
});

// LÓGICA DE AUDIO
startBtn.addEventListener('click', async () => {
    if (isRunning) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaStreamSource = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        mediaStreamSource.connect(analyser);
        
        isRunning = true;
        startBtn.disabled = true;
        startBtn.textContent = "ESCUCHANDO...";
        
        updatePitch();
    } catch (err) {
        alert("Error al acceder al micrófono: " + err);
    }
});

function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
        let val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++)
        if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++)
        if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    let c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++)
        for (let j = 0; j < SIZE - i; j++)
            c[i] = c[i] + buf[j] * buf[j + i];

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    let T0 = maxpos;
    return sampleRate / T0;
}

function updatePitch() {
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    
    const detectedPitch = autoCorrelate(buffer, audioContext.sampleRate);

    if (detectedPitch !== -1) {
        // --- AQUÍ ESTÁ EL TRUCO DEL SUAVIZADO ---
        
        // Si es la primera vez que detectamos (o el salto es gigante), 
        // igualamos directamente para que no tarde años en llegar.
        if (Math.abs(detectedPitch - smoothedPitch) > 50) {
             smoothedPitch = detectedPitch;
        } else {
             // Fórmula de suavizado exponencial
             // NuevoValor = (ValorAnterior * 0.85) + (NuevoDato * 0.15)
             smoothedPitch = (smoothedPitch * (1 - smoothingAlpha)) + (detectedPitch * smoothingAlpha);
        }

        // Usamos smoothedPitch en lugar de detectedPitch para la visualización
        freqDisplay.textContent = Math.round(smoothedPitch) + " Hz";
        moveNeedle(smoothedPitch, targetFreq);
    }

    if (isRunning) requestAnimationFrame(updatePitch);
}

function moveNeedle(current, target) {
    let cents = 1200 * Math.log2(current / target);
    if (cents > 50) cents = 50;
    if (cents < -50) cents = -50;
    let degrees = (cents / 50) * 90;
    needle.style.transform = `translateX(-50%) rotate(${degrees}deg)`;

    if (Math.abs(cents) < 5) {
        statusMsg.textContent = "¡AFINADO!";
        needle.style.backgroundColor = "#2ecc71";
    } else {
        statusMsg.textContent = cents < 0 ? "Bajo (Aprieta)" : "Alto (Afloja)";
        needle.style.backgroundColor = "#e74c3c";
    }
}

// Arranque
renderStrings();