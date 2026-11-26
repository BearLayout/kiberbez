(function() {
            const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;
            const overlay = document.getElementById('game-overlay'), startScreen = document.getElementById('game-start-screen'), overScreen = document.getElementById('game-over-screen');
            const startBtn = document.getElementById('startGameBtn'), restartBtn = document.getElementById('restartGameBtn'), saveBtn = document.getElementById('saveScoreBtn'), finalScoreEl = document.getElementById('final-score'), scoreEl = document.getElementById('score'), livesEl = document.getElementById('lives');
            const bear = new Image(); bear.src = 'logo.png';
            const GRAV = 0.6, JUMP = -11.6, SPEED = 4.6;
            const P = { x: 120, y: 100, vx: 0, vy: 0, w: 30, h: 38, ground: false, inv: 0 };
            let state = 'idle', fId = null, lastT = 0, score = 0, lives = 3, camX = 0, genX = 0, tick = 0;
            let plats = [], chips = [], viruses = [], parts = [], safe = { x: 120, y: 100 };
            const keys = { l: false, r: false, jump: false };
            const rnd = (a, b) => a + Math.random() * (b - a);

            function addPlatform(x, y, w) { plats.push({ x, y, w }); const n = Math.floor(w / 70);
                for (let i = 0; i < n; i++) { if (Math.random() < 0.5) chips.push({ x: x + rnd(20, w - 20), y: y - 30, t: Math.random() * 6 }); }
                if (Math.random() < 0.55) viruses.push({ x: x + w / 2, y: y - 22, dir: 1, min: x + 10, max: x + w - 24, sp: rnd(1, 2.2) }); }
            function gen() { while (genX < camX + W + 500) { genX += rnd(60, 140); const w = rnd(120, 260), y = H - 40 - rnd(0, 240); addPlatform(genX, y, w); genX += w; }
                plats = plats.filter(p => p.x + p.w > camX - 100); chips = chips.filter(c => c.x > camX - 60); viruses = viruses.filter(v => v.x > camX - 60); }
            function burst(x, y, color, n = 14) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-3, 3), vy: rnd(-4, 1), life: rnd(20, 40), color }); }
            function reset() { score = 0; lives = 3; camX = 0; genX = 0; P.x = 120; P.y = 100; P.vx = 0; P.vy = 0; P.inv = 0; safe = { x: 120, y: 100 }; plats = []; chips = []; viruses = []; parts = []; gen(); scoreEl.innerText = '0'; livesEl.innerText = '🛡️🛡️🛡️'; }
            function startGame() { if (state === 'playing') return; reset(); state = 'playing'; startScreen.classList.add('hidden'); overScreen.classList.add('hidden'); overlay.classList.add('hidden'); lastT = 0; if (fId) cancelAnimationFrame(fId); fId = requestAnimationFrame(loop); }
            function endGame() { state = 'gameover'; if (fId) cancelAnimationFrame(fId); fId = null; finalScoreEl.innerText = score; document.getElementById('pName').value = ''; overlay.classList.remove('hidden'); overScreen.classList.remove('hidden'); playBeep(50, 'sawtooth', 0.5); }
            function hurt() { if (P.inv > 0) return; lives--; burst(P.x + 15, P.y + 19, '#ff4757', 20); playBeep(80, 'square', 0.4);
                if (lives <= 0) { livesEl.innerText = ''; endGame(); return; }
                livesEl.innerText = '🛡️'.repeat(lives); P.x = safe.x; P.y = safe.y; P.vy = 0; P.inv = 90; }
            function physics() { const oldY = P.y; P.vy += GRAV; P.y += P.vy; P.ground = false;
                for (const p of plats) { if (P.x + P.w > p.x && P.x < p.x + p.w) { const top = p.y;
                    if (oldY + P.h <= top + 1 && P.y + P.h >= top && P.vy >= 0) { P.y = top - P.h; P.vy = 0; P.ground = true;
                        if (P.inv <= 0) safe = { x: P.x, y: P.y };
                        if (!P.wasGround) burst(P.x + 15, P.y + P.h, 'rgba(0,210,255,0.7)', 6); } } }
                P.wasGround = P.ground; }
            function loop(t) { if (state !== 'playing') return; const dt = Math.min((t - lastT) || 16, 40); lastT = t; tick += dt;
                const acc = P.ground ? 0.9 : 0.5;
                if (keys.l) P.vx = Math.max(P.vx - acc * 0.8, -SPEED);
                if (keys.r) P.vx = Math.min(P.vx + acc * 0.8, SPEED);
                if (!keys.l && !keys.r) P.vx *= 0.86;
                P.x += P.vx; physics();
                if (P.x < camX + 10) P.x = camX + 10;
                if (P.y > H + 80) hurt();
                camX = Math.max(camX, P.x - 260); gen();
                score = Math.max(score, Math.floor(camX / 60));
                for (let i = chips.length - 1; i >= 0; i--) { const c = chips[i]; c.t += 0.1;
                    if (Math.abs(c.x - (P.x + 15)) < 26 && Math.abs(c.y - (P.y + 19)) < 30) { chips.splice(i, 1); score += 10; burst(c.x, c.y, '#00d2ff', 10); playBeep(600, 'sine', 0.15); } }
                for (const v of viruses) { v.x += v.dir * v.sp; if (v.x < v.min || v.x > v.max) v.dir *= -1;
                    if (P.inv <= 0 && v.x < P.x + P.w && v.x + 22 > P.x && v.y < P.y + P.h && v.y + 22 > P.y) hurt(); }
                if (P.inv > 0) P.inv--;
                for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; if (--p.life <= 0) parts.splice(i, 1); }
                if (!P.ground && tick % 2 === 0) parts.push({ x: P.x + 15, y: P.y + 30, vx: rnd(-0.5, 0.5), vy: rnd(0.5, 1.5), life: 14, color: 'rgba(0,210,255,0.5)' });
                scoreEl.innerText = score; draw(); fId = requestAnimationFrame(loop); }
            function draw() { ctx.fillStyle = '#040810'; ctx.fillRect(0, 0, W, H);
                ctx.strokeStyle = 'rgba(0,210,255,0.08)'; ctx.lineWidth = 1;
                for (let gx = -((camX) % 60); gx < W; gx += 60) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
                for (let gy = 0; gy < H; gy += 60) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
                ctx.save(); ctx.translate(-camX, 0);
                for (const p of plats) { ctx.shadowBlur = 12; ctx.shadowColor = '#00d2ff'; ctx.fillStyle = '#0b2036'; ctx.fillRect(p.x, p.y, p.w, 26); ctx.strokeStyle = '#00d2ff'; ctx.strokeRect(p.x, p.y, p.w, 26); }
                for (const c of chips) { const bob = Math.sin(c.t) * 4; ctx.shadowBlur = 15; ctx.shadowColor = '#00d2ff'; ctx.fillStyle = '#00d2ff'; ctx.fillRect(c.x - 6, c.y - 6 + bob, 12, 12); }
                ctx.shadowBlur = 0;
                for (const v of viruses) { ctx.shadowBlur = 12; ctx.shadowColor = '#ff4757'; ctx.fillStyle = '#ff4757'; ctx.beginPath(); ctx.moveTo(v.x + 11, v.y); ctx.lineTo(v.x + 22, v.y + 22); ctx.lineTo(v.x, v.y + 22); ctx.closePath(); ctx.fill(); }
                ctx.shadowBlur = 0;
                for (const p of parts) { ctx.globalAlpha = Math.min(1, p.life / 20); ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); } ctx.globalAlpha = 1;
                const blink = P.inv > 0 && Math.floor(P.inv / 6) % 2 === 0;
                if (!blink) { if (bear.complete && bear.naturalWidth > 0) { try { ctx.drawImage(bear, P.x, P.y, P.w, P.h); } catch (e) { drawCube(); } } else drawCube(); }
                ctx.restore(); }
            function drawCube() { ctx.shadowBlur = 15; ctx.shadowColor = '#00d2ff'; ctx.fillStyle = '#00d2ff'; ctx.fillRect(P.x, P.y, P.w, P.h); ctx.fillStyle = '#040810'; ctx.fillRect(P.x + 7, P.y + 12, 4, 4); ctx.fillRect(P.x + 19, P.y + 12, 4, 4); ctx.shadowBlur = 0; }
            const setJump = v => { if (v && P.ground) { P.vy = JUMP; P.ground = false; burst(P.x + 15, P.y + P.h, 'rgba(0,210,255,0.6)', 8); playBeep(300, 'sine', 0.1); } };
            document.addEventListener('keydown', e => { if (state !== 'playing') return;
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = true;
                if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = true;
                if (e.code === 'Space' || e.code === 'ArrowUp') { if (!keys.jump) setJump(true); keys.jump = true; e.preventDefault(); } });
            document.addEventListener('keyup', e => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = false;
                if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = false;
                if (e.code === 'Space' || e.code === 'ArrowUp') keys.jump = false; });
            function bindHold(id, fn) { const el = document.getElementById(id); if (!el) return;
                el.addEventListener('pointerdown', e => { e.preventDefault(); fn(true); });
                ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => fn(false))); }
            bindHold('tLeft', v => keys.l = v); bindHold('tRight', v => keys.r = v);
            bindHold('tJump', v => { if (v && !keys.jump) setJump(true); keys.jump = v; });
            startBtn.onclick = startGame; restartBtn.onclick = startGame;
            saveBtn.onclick = async () => { let name = (document.getElementById('pName').value || '').trim();
                if (name.length < 3) name = 'Аноним'; if (name.length > 16) name = name.slice(0, 16);
                const sc = Math.max(0, Math.min(10000, score));
                try { await supabaseClient.from('game_leaderboard').insert([{ player_name: name, score: sc }]); } catch (e) {}
                showLeaderboard(); };
            window.stopGameLoop = () => { if (fId) { cancelAnimationFrame(fId); fId = null; } };
            window.redrawGame = () => { if (state === 'idle') draw(); };
            draw();
        })();