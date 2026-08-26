/*
 * Motion Trail Sculptor
 * A readable, model-free camera baseline. A future version can replace
 * analyzeFrame() with MediaPipe landmarks without changing the UI contract.
 */
const mode = 'motion';
const video = document.querySelector('#video');
const canvas = document.querySelector('#canvas');
const context = canvas.getContext('2d');
const analysisCanvas = document.createElement('canvas');
const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
const sample = document.querySelector('#sample');
const status = document.querySelector('#status');
const metrics = document.querySelector('#metrics');
const startButton = document.querySelector('#start-camera');
const sampleButton = document.querySelector('#use-sample');
const clearButton = document.querySelector('#clear');
const saveButton = document.querySelector('#save');
const pointer = { x: .5, y: .5, energy: .5 };
const trail = [];
let stream = null;
let cameraActive = false;
let animationFrame = 0;
let lastSignal = { x: .5, y: .5, energy: .5, contrast: .3 };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
function hsv(hue, saturation, value, alpha = 1) {
  const h = ((hue % 360) + 360) % 360 / 60;
  const c = value * saturation;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = value - c;
  const colors = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return `rgba(${Math.round((colors[0] + m) * 255)}, ${Math.round((colors[1] + m) * 255)}, ${Math.round((colors[2] + m) * 255)}, ${alpha})`;
}

function analyzeFrame() {
  const width = 64; const height = 36;
  analysisCanvas.width = width; analysisCanvas.height = height;
  analysisContext.drawImage(video, 0, 0, width, height);
  const pixels = analysisContext.getImageData(0, 0, width, height).data;
  let total = 0; let xTotal = 0; let yTotal = 0; let contrast = 0; let previous = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    const sampleIndex = index / 4; const x = sampleIndex % width; const y = Math.floor(sampleIndex / width);
    const luminance = (pixels[index] * .299 + pixels[index + 1] * .587 + pixels[index + 2] * .114) / 255;
    const weight = .05 + luminance * luminance;
    total += weight; xTotal += x * weight; yTotal += y * weight;
    contrast += Math.abs(luminance - previous); previous = luminance;
  }
  return { x: clamp(xTotal / Math.max(total, 1) / width), y: clamp(yTotal / Math.max(total, 1) / height), energy: clamp(total / 120), contrast: clamp(contrast / 90) };
}

function sampleSignal(time) {
  const speed = reducedMotion ? .00025 : .0007;
  return { x: .5 + Math.sin(time * speed) * .28, y: .5 + Math.cos(time * speed * 1.35) * .22, energy: .5 + Math.sin(time * speed * 2) * .25, contrast: .35 + Math.cos(time * speed) * .25 };
}

function drawBackground(width, height, signal, time) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0a1830'); gradient.addColorStop(.52, hsv(190 + signal.x * 120, .72, .32)); gradient.addColorStop(1, '#130b2c');
  context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  for (let i = 0; i < 14; i += 1) {
    const x = width * (i / 14) + Math.sin(time / 1100 + i) * 30;
    const y = height * (.22 + ((i * .17 + signal.y * .3) % .62));
    context.fillStyle = hsv(175 + i * 13, .6, 1, .3);
    context.beginPath(); context.arc(x, y, 2 + (i % 4), 0, Math.PI * 2); context.fill();
  }
}

function drawHand(width, height, signal, time) {
  const x = signal.x * width; const y = signal.y * height;
  for (let i = 0; i < 46; i += 1) {
    const angle = i * .73 + time / 900; const radius = (i * 17 + time / 3) % Math.max(width, height) * .18;
    const px = x + Math.cos(angle) * radius; const py = y + Math.sin(angle) * radius;
    context.fillStyle = hsv(170 + i * 4, .78, 1, .42); context.beginPath(); context.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2); context.fill();
  }
  context.strokeStyle = 'rgba(255,255,255,.74)'; context.lineWidth = 2; context.beginPath(); context.arc(x, y, 18 + signal.energy * 34, 0, Math.PI * 2); context.stroke();
  context.fillStyle = '#fef08a'; context.beginPath(); context.arc(x, y, 7, 0, Math.PI * 2); context.fill();
}

function drawPaint(width, height, signal) {
  trail.push({ x: signal.x * width, y: signal.y * height }); if (trail.length > 120) trail.shift();
  context.lineCap = 'round'; context.lineJoin = 'round';
  for (let i = 1; i < trail.length; i += 1) { const alpha = i / trail.length; context.strokeStyle = hsv(175 + i * 1.2, .8, 1, alpha * .72); context.lineWidth = 2 + alpha * 10; context.beginPath(); context.moveTo(trail[i - 1].x, trail[i - 1].y); context.lineTo(trail[i].x, trail[i].y); context.stroke(); }
}

function drawMicroscope(width, height, signal) {
  context.strokeStyle = 'rgba(142,240,255,.2)'; context.lineWidth = 1;
  for (let x = 0; x < width; x += 24) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
  for (let y = 0; y < height; y += 24) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  const x = signal.x * width; const y = signal.y * height; const radius = Math.min(width, height) * .2;
  context.fillStyle = 'rgba(3,10,20,.62)'; context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
  context.strokeStyle = '#fef08a'; context.lineWidth = 3; context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.stroke();
  const color = hsv(signal.x * 360, .75, .95); context.fillStyle = color; context.fillRect(x - 16, y - 16, 32, 32);
}

function drawMotion(width, height, signal, time) {
  trail.push({ x: signal.x * width, y: signal.y * height, energy: signal.energy }); if (trail.length > 84) trail.shift();
  for (let i = 1; i < trail.length; i += 1) { const point = trail[i]; const alpha = i / trail.length; context.strokeStyle = hsv(140 + i * 2, .72, 1, alpha * .65); context.lineWidth = 1 + alpha * 5; context.beginPath(); context.arc(point.x, point.y, 10 + alpha * 70 + Math.sin(time / 600 + i) * 8, 0, Math.PI * 2); context.stroke(); }
}

function drawOrchestrator(width, height, signal, time) {
  const centerX = signal.x * width; const centerY = signal.y * height; const open = .25 + signal.energy * .75;
  for (let i = 0; i < 5; i += 1) { const angle = time / 1000 * (i % 2 ? -1 : 1) + i * 1.25; const radius = 30 + i * 22 + open * 35; const x = centerX + Math.cos(angle) * radius; const y = centerY + Math.sin(angle) * radius; context.strokeStyle = hsv(185 + i * 22, .7, 1, .55); context.beginPath(); context.moveTo(centerX, centerY); context.lineTo(x, y); context.stroke(); context.fillStyle = hsv(185 + i * 22, .7, 1, .9); context.beginPath(); context.arc(x, y, 4 + i, 0, Math.PI * 2); context.fill(); }
  context.fillStyle = '#fef08a'; context.beginPath(); context.arc(centerX, centerY, 10 + open * 12, 0, Math.PI * 2); context.fill();
}

function drawAurora(width, height, signal, time) {
  for (let band = 0; band < 7; band += 1) { context.beginPath(); context.moveTo(0, height * (.22 + band * .1)); for (let x = 0; x <= width; x += 16) { const y = height * (.22 + band * .1) + Math.sin(x / 100 + time / 900 + band + signal.x * 4) * (18 + signal.energy * 35); context.lineTo(x, y); } context.strokeStyle = hsv(150 + band * 28 + signal.x * 100, .75, 1, .4); context.lineWidth = 10 + band; context.stroke(); }
}

function drawType(width, height, signal) {
  context.save(); context.translate(signal.x * width, signal.y * height); context.rotate((signal.x - .5) * .3); context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = `900 ${Math.max(28, width * (.12 + signal.energy * .07))}px Inter, sans-serif`; context.fillStyle = hsv(180 + signal.x * 150, .7, 1); context.shadowBlur = 20; context.shadowColor = '#8ef0ff'; context.fillText('MOVE / NOTICE', 0, 0); context.restore();
}

function drawA11y(width, height, signal) {
  const colors = [['#050505', '#f7f7f7'], ['#1d4ed8', '#fef08a'], ['#14532d', '#dcfce7'], ['#581c87', '#f5d0fe']];
  colors.forEach((pair, index) => { const x = width * .12 + (index % 2) * width * .42; const y = height * .18 + Math.floor(index / 2) * height * .38; context.fillStyle = pair[0]; context.fillRect(x, y, width * .3, height * .24); context.fillStyle = pair[1]; context.font = '800 16px Inter, sans-serif'; context.fillText(index === 0 ? 'AA 21:1' : index === 1 ? 'Focus ring' : index === 2 ? 'Reduced motion' : 'Large target', x + 12, y + height * .13); });
  context.strokeStyle = '#fef08a'; context.lineWidth = 4; context.strokeRect(signal.x * width - 34, signal.y * height - 22, 68, 44);
}

function render(time) {
  const width = canvas.clientWidth || 640; const height = canvas.clientHeight || 360;
  if (cameraActive && video.readyState >= 2) { try { lastSignal = analyzeFrame(); } catch { /* retain last local signal */ } }
  else { lastSignal = { ...sampleSignal(time), x: cameraActive ? lastSignal.x : pointer.x, y: cameraActive ? lastSignal.y : pointer.y }; }
  context.clearRect(0, 0, width, height); drawBackground(width, height, lastSignal, time);
  if (mode === 'hand') drawHand(width, height, lastSignal, time);
  if (mode === 'paint') drawPaint(width, height, lastSignal);
  if (mode === 'microscope') drawMicroscope(width, height, lastSignal);
  if (mode === 'motion') drawMotion(width, height, lastSignal, time);
  if (mode === 'orchestrator') drawOrchestrator(width, height, lastSignal, time);
  if (mode === 'aurora') drawAurora(width, height, lastSignal, time);
  if (mode === 'type') drawType(width, height, lastSignal);
  if (mode === 'a11y') drawA11y(width, height, lastSignal);
  metrics.textContent = `${cameraActive ? 'Camera signal' : 'Pointer/sample fallback'} · energy ${lastSignal.energy.toFixed(2)} · contrast ${lastSignal.contrast.toFixed(2)} · ${reducedMotion ? 'reduced motion' : 'full motion'}`;
  animationFrame = requestAnimationFrame(render);
}

function updatePointer(event) { const rect = canvas.getBoundingClientRect(); pointer.x = clamp((event.clientX - rect.left) / rect.width); pointer.y = clamp((event.clientY - rect.top) / rect.height); pointer.energy = .5 + Math.abs(pointer.x - .5); }
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { status.textContent = 'Camera needs HTTPS or localhost. The fallback remains available.'; return; }
  status.textContent = 'Requesting camera permission…';
  try { stream?.getTracks().forEach((track) => track.stop()); stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); video.srcObject = stream; await video.play(); cameraActive = true; sample.hidden = true; trail.length = 0; status.textContent = 'Camera active. Frames stay local and are not uploaded.'; }
  catch (error) { cameraActive = false; status.textContent = error.name === 'NotAllowedError' ? 'Permission was not granted. Pointer fallback remains available.' : 'Camera unavailable. Pointer fallback remains available.'; }
}
function useSample() { stream?.getTracks().forEach((track) => track.stop()); stream = null; video.srcObject = null; cameraActive = false; sample.hidden = false; trail.length = 0; status.textContent = 'Sample mode is ready. No camera permission is required.'; }
function clearState() { trail.length = 0; context.clearRect(0, 0, canvas.width, canvas.height); status.textContent = 'Local trail/state cleared.'; }
function savePng() { const link = document.createElement('a'); link.download = 'motion_trail_sculptor-canvas.png'; link.href = canvas.toDataURL('image/png'); link.click(); status.textContent = 'PNG prepared locally.'; }

window.addEventListener('resize', resize); canvas.addEventListener('pointermove', updatePointer); canvas.addEventListener('pointerdown', updatePointer); startButton.addEventListener('click', startCamera); sampleButton.addEventListener('click', useSample); clearButton.addEventListener('click', clearState); saveButton.addEventListener('click', savePng); window.addEventListener('pagehide', () => stream?.getTracks().forEach((track) => track.stop()));
resize(); render(performance.now());
