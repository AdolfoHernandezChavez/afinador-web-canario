let audioContext;
let analyser;
let isRunning = false;
let currentInstrument = 'timple';
let targetFrequency = 0; 

// --- BASE DE DATOS DE INSTRUMENTOS CANARIOS ---

// 1. TIMPLE (Re-La-Mi-Do-Sol)
const datosTimple = [
    { num: '1ª', nota: 'D5 (Re)', freq: 587.33 },
    { num: '2ª', nota: 'A4 (La)', freq: 440.00 },
    { num: '3ª', nota: 'E4 (Mi)', freq: 329.63 },
    { num: '4ª', nota: 'C5 (Do)', freq: 523.25 },
    { num: '5ª', nota: 'G4 (Sol)', freq: 392.00 }
];

// 2. CONTRA (Timple Contra - Una 5ª más grave: Sol-Re-La-Fa-Do)
const datosContra = [
    { num: '1ª', nota: 'G4 (Sol)', freq: 392.00 },
    { num: '2ª', nota: 'D4 (Re)', freq: 293.66 },
    { num: '3ª', nota: 'A3 (La)', freq: 220.00 },
    { num: '4ª', nota: 'F4 (Fa)', freq: 349.23 },
    { num: '5ª', nota: 'C4 (Do)', freq: 261.63 }
];

// 3. GUITARRA (Mi-Si-Sol-Re-La-Mi)
const datosGuitarra = [
    { num: '1ª', nota: 'E4 (Mi)', freq: 329.63 },
    { num: '2ª', nota: 'B3 (Si)', freq: 246.94 },
    { num: '3ª', nota: 'G3 (Sol)', freq: 196.00 },
    { num: '4ª', nota: 'D3 (Re)', freq: 146.83 },
    { num: '5ª', nota: 'A2 (La)', freq: 110.00 },
    { num: '6ª', nota: 'E2 (Mi)', freq: 82.41 }
];

// 4. BANDURRIA (La-Mi-Si-Fa#-Do#-Sol#)
const datosBandurria = [
    { num: '1ª', nota: 'A5 (La)', freq: 880.00 },
    { num: '2ª', nota: 'E5 (Mi)', freq: 659.25 },
    { num: '3ª', nota: 'B4 (Si)', freq: 493.88 },
    { num: '4ª', nota: 'F#4 (Fa#)', freq: 369.99 },
    { num: '5ª', nota: 'C#4 (Do#)', freq: 277.18 },
    { num: '6ª', nota: 'G#3 (Sol#)', freq: 207.65 }
];

// 5. LAÚD (Igual que Bandurria pero una octava más grave)
const datosLaud = [
    { num: '1ª', nota: 'A4 (La)', freq: 440.00 },
    { num: '2ª', nota: 'E4 (Mi)', freq: 329.63 },
    { num: '3ª', nota: 'B3 (Si)', freq: 246.94 },
    { num: '4ª', nota: 'F#3 (Fa#)', freq: 185.00 },
    { num: '5ª', nota: 'C#3 (Do#)', freq: 138.59 },
    { num: '6ª', nota: 'G#2 (Sol#)', freq: 103.83 }
];

window.onload = () => {
    generarBotones('timple');
};

function cambiarInstrumento(inst) {
    currentInstrument = inst;
    
    // Resetear clases de botones
    const botonesMenu = document.querySelectorAll('.toggle-container button');
    botonesMenu.forEach(btn => btn.className = '');
    
    // Activar el botón pulsado
    document.getElementById('btn-' + inst).className = 'active';
    
    // Regenerar las cuerdas
    generarBotones(inst);
}

function generarBotones(inst) {
    const contenedor = document.getElementById('cuerdas-container');
    contenedor.innerHTML = ''; 
    
    let datos;
    if (inst === 'timple') datos = datosTimple;
    else if (inst === 'contra') datos = datosContra;
    else if (inst === 'guitarra') datos = datosGuitarra;
    else if (inst === 'bandurria') datos = datosBandurria;
    else if (inst === 'laud') datos = datosLaud;

    datos.forEach((cuerda, index) => {
        const btn = document.createElement('button');
        btn.className = 'string-btn';
        btn.innerText = cuerda.num;
        btn.onclick = () => seleccionarCuerda(index, datos); // Pasamos los datos directamente
        contenedor.appendChild(btn);
        
        if (index === 0) btn.click();
    });
}

function seleccionarCuerda(index, datos) {
    const cuerda = datos[index];
    targetFrequency = cuerda.freq; 
    
    // Actualizar botones (Visual)
    const botones = document.querySelectorAll('.string-btn');
    botones.forEach(b => b.classList.remove('selected'));
    botones[index].classList.add('selected');

    // Actualizar pantalla
    document.getElementById('note-name').innerText = cuerda.nota.split(" ")[0]; // Solo la nota (ej: A4)
    document.getElementById('status').innerText = "Afina: " + cuerda.nota;
    document.getElementById('note-name').style.color = "#fff"; 
}

// ... EL RESTO DEL CÓDIGO (iniciarAudio, bucleAfinacion, etc.) SIGUE IGUAL ...

async function iniciarAudio() {
    if (isRunning) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 4096; // Mayor precisión
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        isRunning = true;
        document.getElementById('btn-start').innerHTML = "<span class='material-icons'>mic_off</span> PAUSAR";
        document.getElementById('btn-start').onclick = function() { location.reload(); };
        document.getElementById('btn-start').style.background = "var(--ocean-blue)"; 

        bucleAfinacion();
    } catch (err) {
        alert("Error de micrófono: " + err);
    }
}

function bucleAfinacion() {
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const freqDetectada = autoCorrelate(buffer, audioContext.sampleRate);

    if (freqDetectada !== -1) {
        actualizarAguja(freqDetectada);
    } 
    requestAnimationFrame(bucleAfinacion);
}

function actualizarAguja(freqInput) {
    // Calculamos la diferencia solo con la cuerda SELECCIONADA
    const diferencia = freqInput - targetFrequency;

    // Mostrar frecuencia real
    document.getElementById('frequency').innerText = freqInput.toFixed(1) + " Hz";

    // Mover aguja
    // Sensibilidad: +/- 15 Hz mueve la aguja al tope (45 grados)
    let angulo = diferencia * 3; 
    if (angulo > 60) angulo = 60;
    if (angulo < -60) angulo = -60;

    const needle = document.getElementById('needle');
    needle.style.transform = `translateX(-50%) rotate(${angulo}deg)`;

    // Feedback Visual
    const display = document.getElementById('note-name');
    const status = document.getElementById('status');
    const margen = 1.0; // Hz de margen para darlo por bueno

    if (Math.abs(diferencia) < margen) {
        // AFINADO
        needle.style.background = "var(--canary-yellow)";
        display.style.color = "var(--canary-yellow)";
        status.innerText = "¡PERFECTO!";
        status.style.color = "var(--canary-yellow)";
    } else {
        // DESAFINADO
        needle.style.background = "#ff4d4d"; // Rojo
        display.style.color = "#fff";
        
        // Lógica de "Afloja" o "Aprieta"
        if (diferencia < 0) {
            status.innerText = "Aprieta (Sube)";
            status.style.color = "#ff9999";
        } else {
            status.innerText = "Afloja (Baja)";
            status.style.color = "#ff9999";
        }
    }
}

// Algoritmo matemático (Autocorrelación) - NO TOCAR
function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i=0;i<SIZE;i++) { let val = buf[i]; rms+=val*val; }
    rms = Math.sqrt(rms/SIZE);
    if (rms<0.01) return -1; // Silencio

    let r1=0, r2=SIZE-1, thres=0.2;
    for (let i=0; i<SIZE/2; i++) if (Math.abs(buf[i])<thres) { r1=i; break; }
    for (let i=1; i<SIZE/2; i++) if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }
    buf = buf.slice(r1,r2);
    SIZE = buf.length;

    let c = new Array(SIZE).fill(0);
    for (let i=0; i<SIZE; i++)
        for (let j=0; j<SIZE-i; j++)
            c[i] = c[i] + buf[j]*buf[j+i];

    let d=0; while (c[d]>c[d+1]) d++;
    let maxval=-1, maxpos=-1;
    for (let i=d; i<SIZE; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    let T0 = maxpos;
    let x1=c[T0-1], x2=c[T0], x3=c[T0+1];
    let a = (x1+x3-2*x2)/2;
    let b = (x3-x1)/2;
    if (a) T0 = T0 - b/(2*a);

    return sampleRate/T0;
}