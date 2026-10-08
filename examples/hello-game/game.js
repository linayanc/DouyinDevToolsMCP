// A local-only diagnostic mini game. No network, credentials, or uploads.
const canvas = tt.createCanvas();
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#121827';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#43e8d8';
ctx.font = '20px sans-serif';
ctx.fillText('Douyin MCP: connected', 20, 70);
console.log('[douyin-mcp-demo] game started');
console.warn('[douyin-mcp-demo] example warning');
console.error('[douyin-mcp-demo] example error (intentional)');
let tick = 0;
setInterval(() => console.log('[douyin-mcp-demo] tick', ++tick), 5000);
setTimeout(() => { throw new Error('[douyin-mcp-demo] example exception (intentional)'); }, 3000);
