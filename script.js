let audioContext;
let analyser;
let source;
let isRunning = false;

// Configuración de notas (Frecuencias exactas)
const notasTimple = [
    { nota: 'D5 (Re)', freq: 587.33 },
    { nota: 'A4 (La)', freq: 440.00 },
    { nota: 'E4 (Mi)', freq: 329.63 },
    { nota: 'C5 (Do)', freq: 523.25 },
    { nota: 'G4 (Sol)', freq: 392.00 }
];

const notasGuitarra = [
    { nota: 'E4 (Mi)', freq: 329.63 },
    { nota: 'B3 (Si)', freq: 246.94 },
    { nota: 'G3 (Sol)', freq: 196.00 },
    { nota: 'D3 (Re)', freq: 146.83 },
    { nota: 'A2 (La)', freq: 110.00 },
    { nota: 'E2 (Mi)', freq: 82.41 }
];

let instrumentoActual = notasTimple; // Por defecto Timple

function cambiarInstrumento(inst) {
    if (inst === 'timple') {
        instrumentoActual = notasTimple;
        document.getElementById('btn-timple').className = 'active';
        document.getElementById('btn-guitarra').className = '';
    } else {
        instrumentoActual = notasGuitarra;
        document.getElementById('btn-timple').className = '';
        document.getElementById('btn-guitarra').className = 'active';
    }
}

async function iniciarAudio() {
    if (isRunning) return;

    try {
        // Pedir permiso al micrófono
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // Tamaño del buffer para precisión
        
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        isRunning = true;
        document.getElementById('btn-start').innerHTML = "<span class='material-icons'>graphic_eq</span> Escuchando...";
        document.getElementById('btn-start').style.background = "#00ff88"; // Verde neón
        document.getElementById('btn-start').style.color = "#000";

        actualizar();

    } catch (err) {
        alert("Error: No se pudo acceder al micrófono. Asegúrate de dar permisos.");
        console.error(err);
    }
}

function actualizar() {
    if (!isRunning) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    // LLAMADA AL ALGORITMO MATEMÁTICO (Sin librerías externas)
    const freq = autoCorrelate(buffer, audioContext.sampleRate);

    if (freq !== -1) {
        mostrarDatos(freq);
    } else {
        // Si hay silencio o ruido, relajamos la aguja
        // document.getElementById('frequency').innerText = "...";
    }

    requestAnimationFrame(actualizar);
}

function mostrarDatos(freq) {
    // 1. Encontrar la nota más cercana en el instrumento seleccionado
    let notaMasCercana = instrumentoActual[0];
    let menorDiferencia = Infinity;

    instrumentoActual.forEach(n => {
        let diff = Math.abs(freq - n.freq);
        if (diff < menorDiferencia) {
            menorDiferencia = diff;
            notaMasCercana = n;
        }
    });

    // 2. Calcular diferencia para la aguja
    let diferencia = freq - notaMasCercana.freq;
    
    // Actualizar Textos
    document.getElementById('note-name').innerText = notaMasCercana.nota.split(" ")[0]; // Solo la letra (A4, E4...)
    document.getElementById('frequency').innerText = freq.toFixed(1) + " Hz";

    // 3. Mover la Aguja (Lógica visual)
    // Sensibilidad: +/- 10 Hz mueve la aguja al tope
    let grados = diferencia * 3; 
    if (grados > 45) grados = 45;
    if (grados < -45) grados = -45;

    const aguja = document.getElementById('needle');
    aguja.style.transform = `translateX(-50%) rotate(${grados}deg)`;

    // 4. Colores (Verde si está cerca, Rojo si no)
    const status = document.getElementById('status');
    const noteDisplay = document.getElementById('note-name');
    
    if (Math.abs(diferencia) < 1.5) { // Margen de error pequeño
        noteDisplay.style.color = "#00ff88"; // Verde
        aguja.style.background = "#00ff88";
        status.innerText = "¡PERFECTO!";
        status.style.color = "#00ff88";
    } else {
        noteDisplay.style.color = "#ffffff";
        aguja.style.background = "#ff4d4d"; // Rojo
        status.innerText = diferencia < 0 ? "Sube un poco (Aprieta)" : "Baja un poco (Afloja)";
        status.style.color = "#ff4d4d";
    }
}

// --- ALGORITMO DE AUTOCORRELACIÓN (Sustituye a PitchFinder) ---
// Este algoritmo detecta la repetición de la onda de sonido
function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;

    // 1. Detectar si hay suficiente volumen (Silencio)
    for (let i = 0; i < SIZE; i++) {
        let val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // Muy poco volumen

    // 2. Recortar bordes de la señal
    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++)
        if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++)
        if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    // 3. Autocorrelación
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

    // 4. Interpolación parabólica para mayor precisión
    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
}