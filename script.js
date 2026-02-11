let audioContext;
let analyser;
let isRunning = false;
let currentInstrument = 'timple';
let targetFrequency = 0; // La frecuencia de la cuerda elegida

// --- DATOS DE LAS CUERDAS ---
// Orden: 1ª (abajo) a 5ª/6ª (arriba)
const datosTimple = [
    { num: '1ª', nota: 'D5', freq: 587.33 }, // Re
    { num: '2ª', nota: 'A4', freq: 440.00 }, // La
    { num: '3ª', nota: 'E4', freq: 329.63 }, // Mi
    { num: '4ª', nota: 'C5', freq: 523.25 }, // Do
    { num: '5ª', nota: 'G4', freq: 392.00 }  // Sol
];

const datosGuitarra = [
    { num: '1ª', nota: 'E4', freq: 329.63 }, // Mi
    { num: '2ª', nota: 'B3', freq: 246.94 }, // Si
    { num: '3ª', nota: 'G3', freq: 196.00 }, // Sol
    { num: '4ª', nota: 'D3', freq: 146.83 }, // Re
    { num: '5ª', nota: 'A2', freq: 110.00 }, // La
    { num: '6ª', nota: 'E2', freq: 82.41 }   // Mi
];

// Al cargar la página, generamos los botones del Timple
window.onload = () => {
    generarBotones('timple');
};

function cambiarInstrumento(inst) {
    currentInstrument = inst;
    
    // Cambiar botones visuales del menú
    document.getElementById('btn-timple').className = inst === 'timple' ? 'active' : '';
    document.getElementById('btn-guitarra').className = inst === 'guitarra' ? 'active' : '';
    
    // Regenerar los botones de las cuerdas
    generarBotones(inst);
}

function generarBotones(inst) {
    const contenedor = document.getElementById('cuerdas-container');
    contenedor.innerHTML = ''; // Limpiar botones anteriores
    
    const datos = inst === 'timple' ? datosTimple : datosGuitarra;

    datos.forEach((cuerda, index) => {
        const btn = document.createElement('button');
        btn.className = 'string-btn';
        btn.innerText = cuerda.num;
        btn.onclick = () => seleccionarCuerda(index, inst);
        contenedor.appendChild(btn);
        
        // Seleccionar la 1ª cuerda por defecto al cambiar instrumento
        if (index === 0) btn.click();
    });
}

function seleccionarCuerda(index, inst) {
    const datos = inst === 'timple' ? datosTimple : datosGuitarra;
    const cuerda = datos[index];
    
    targetFrequency = cuerda.freq; // FIJAMOS EL OBJETIVO
    
    // Actualizar UI visual (colores de botones)
    const botones = document.querySelectorAll('.string-btn');
    botones.forEach(b => b.classList.remove('selected'));
    botones[index].classList.add('selected');

    // Actualizar pantalla
    document.getElementById('note-name').innerText = cuerda.nota;
    document.getElementById('status').innerText = "Toca la " + cuerda.num + " cuerda...";
    document.getElementById('note-name').style.color = "#fff"; // Reset color
}

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
    needle.style.transform = `rotate(${angulo}deg)`;

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