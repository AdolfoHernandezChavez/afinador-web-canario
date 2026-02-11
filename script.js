let audioContext;
let analyser;
let micStream;
let isRunning = false;
let currentInstrument = 'timple';

// Configuración básica de frecuencias (Simplificado para JS puro)
const notasTimple = [
    { nota: 'D5', freq: 587.33 },
    { nota: 'A4', freq: 440.00 },
    { nota: 'E4', freq: 329.63 },
    { nota: 'C5', freq: 523.25 },
    { nota: 'G4', freq: 392.00 }
];

async function iniciarAudio() {
    if (isRunning) return; // Evitar iniciar dos veces

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Crear nodos de audio
        const source = audioContext.createMediaStreamSource(micStream);
        analyser = audioContext.createAnalyser();
        source.connect(analyser);
        
        // Configurar detección (Usando la librería externa por ahora)
        // NOTA: Cuando tengas tu C++ listo, aquí llamarás a tu WASM
        const detectPitch = PitchFinder.YIN({ sampleRate: audioContext.sampleRate });
        const buffer = new Float32Array(analyser.fftSize);

        function bucle() {
            analyser.getFloatTimeDomainData(buffer);
            const freq = detectPitch(buffer);

            if (freq) {
                actualizarInterfaz(freq);
            } else {
                // Si hay silencio, volver la aguja al centro poco a poco o dejarla caer
            }
            requestAnimationFrame(bucle);
        }

        bucle();
        isRunning = true;
        document.getElementById('btn-start').innerHTML = "Escuchando...";
        document.getElementById('btn-start').style.background = "var(--primary)";
        document.getElementById('btn-start').style.color = "#000";

    } catch (e) {
        alert("Error al acceder al micro: " + e);
    }
}

function actualizarInterfaz(freq) {
    // 1. Buscar la nota más cercana en el timple
    // (Esta es una lógica simple, tu C++ es más potente)
    let notaMasCercana = notasTimple[0];
    let menorDiferencia = Infinity;

    notasTimple.forEach(n => {
        let diff = Math.abs(freq - n.freq);
        if (diff < menorDiferencia) {
            menorDiferencia = diff;
            notaMasCercana = n;
        }
    });

    // 2. Mostrar datos
    document.getElementById('note-name').innerText = notaMasCercana.nota;
    document.getElementById('frequency').innerText = freq.toFixed(1) + " Hz";

    // 3. Mover la aguja
    // Calculamos qué tan lejos estamos (rango de +/- 50 cents aprox)
    let diferencia = freq - notaMasCercana.freq;
    let grados = diferencia * 2; // Factor de escala para movimiento visual
    
    // Limitar el movimiento de la aguja a +/- 45 grados
    if (grados > 45) grados = 45;
    if (grados < -45) grados = -45;

    const aguja = document.getElementById('needle');
    aguja.style.transform = `translateX(-50%) rotate(${grados}deg)`;

    // 4. Cambiar color si está afinado (margen de 0.5 Hz)
    const display = document.getElementById('note-name');
    if (Math.abs(diferencia) < 0.5) {
        display.style.color = "var(--primary)"; // Verde
        document.getElementById('status').innerText = "¡AFINADO!";
    } else {
        display.style.color = (diferencia < 0) ? "#ff9500" : "#ff4d4d"; // Naranja (bajo) o Rojo (alto)
        document.getElementById('status').innerText = diferencia < 0 ? "Sube un poco" : "Baja un poco";
    }
}

function cambiarInstrumento(inst) {
    currentInstrument = inst;
    document.getElementById('btn-timple').className = inst === 'timple' ? 'active' : '';
    document.getElementById('btn-guitarra').className = inst === 'guitarra' ? 'active' : '';
    // Aquí cargarías las frecuencias de la guitarra si fuera el caso
}