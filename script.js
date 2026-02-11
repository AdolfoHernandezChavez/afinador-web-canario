let audioContext;
let analyser;
let isRunning = false;
let currentInstrument = 'timple';

const notasTimple = [
    { nota: 'D5', freq: 587.33 },
    { nota: 'A4', freq: 440.00 },
    { nota: 'E4', freq: 329.63 },
    { nota: 'C5', freq: 523.25 },
    { nota: 'G4', freq: 392.00 }
];

const notasGuitarra = [
    { nota: 'E4', freq: 329.63 },
    { nota: 'B3', freq: 246.94 },
    { nota: 'G3', freq: 196.00 },
    { nota: 'D3', freq: 146.83 },
    { nota: 'A2', freq: 110.00 },
    { nota: 'E2', freq: 82.41 }
];

function cambiarInstrumento(inst) {
    currentInstrument = inst;
    document.getElementById('btn-timple').className = inst === 'timple' ? 'active' : '';
    document.getElementById('btn-guitarra').className = inst === 'guitarra' ? 'active' : '';
}

async function iniciarAudio() {
    if (isRunning) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        isRunning = true;
        document.getElementById('btn-start').innerHTML = "<span class='material-icons'>mic_off</span> DETENER";
        document.getElementById('btn-start').onclick = function() { location.reload(); }; // Reset rápido
        document.getElementById('btn-start').style.background = "#444"; 

        actualizar();
    } catch (err) {
        alert("¡Necesitamos el micrófono para afinar! Comprueba los permisos.");
    }
}

function actualizar() {
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const freq = autoCorrelate(buffer, audioContext.sampleRate);

    if (freq !== -1) {
        mostrarDatos(freq);
    } 
    requestAnimationFrame(actualizar);
}

function mostrarDatos(freq) {
    const notas = currentInstrument === 'timple' ? notasTimple : notasGuitarra;
    
    // Buscar nota más cercana
    let notaCercana = notas[0];
    let minDiff = Infinity;

    notas.forEach(n => {
        let diff = Math.abs(freq - n.freq);
        if (diff < minDiff) {
            minDiff = diff;
            notaCercana = n;
        }
    });

    const diferencia = freq - notaCercana.freq;

    // Actualizar UI
    document.getElementById('note-name').innerText = notaCercana.nota;
    document.getElementById('frequency').innerText = freq.toFixed(1) + " Hz";

    // MOVER AGUJA
    // Mapeamos +/- 10Hz a +/- 45 grados
    let angulo = diferencia * 4; 
    if (angulo > 90) angulo = 90;
    if (angulo < -90) angulo = -90;

    const needle = document.getElementById('needle');
    needle.style.transform = `rotate(${angulo}deg)`;

    // COLORES
    const display = document.getElementById('note-name');
    const status = document.getElementById('status');

    // Margen de afinación (1 Hz)
    if (Math.abs(diferencia) < 1.0) {
        needle.style.background = "#00ff88"; // Verde
        display.style.color = "#00ff88";
        status.innerText = "¡AFINADO!";
        status.style.color = "#00ff88";
    } else {
        needle.style.background = "#ff4d4d"; // Rojo
        display.style.color = "white";
        status.innerText = diferencia < 0 ? "Sube (Aprieta)" : "Baja (Afloja)";
        status.style.color = "#888";
    }
}

// Algoritmo matemático de detección (YIN simplificado)
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