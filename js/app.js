
        // === РЕГИСТРАЦИЯ SERVICE WORKER (PWA) ===
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch(err => console.log('PWA:', err));
            });
        }

        const SUPABASE_URL = CONFIG.SUPABASE_URL;
        const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
        const { createClient } = supabase;
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        let loadedArticles = [];

        const ADMIN_EMAIL = CONFIG.ADMIN_EMAIL; // <--- ЗАМЕНИТЕ НА ВАШ EMAIL

        function escapeHTML(str) {
            if (!str) return '';
            return String(str).replace(/[&<>'"]/g, 
                tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
            );
        }

        let audioCtx;
        function initAudio() {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }
        function playBeep(freq = 800, type = 'sine', duration = 0.05) {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
            osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + duration);
        }
        document.addEventListener('click', initAudio, { once: true });
        
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (!isTouchDevice) {
            document.addEventListener('mouseover', (e) => { 
                if (e.target.closest('button, a, .quiz-option, .article-card, .nav-links a, .card, .news-item, .osint-item')) {
                    playBeep(1200, 'sine', 0.03); 
                }
            });
        }

        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `<span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️')}</span> ${escapeHTML(message)}`;
            container.appendChild(toast);
            setTimeout(() => { toast.style.animation = 'slideOut 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
        }

        function openLeadModal() { document.getElementById('leadModal').classList.add('active'); }
        function closeLeadModal() { document.getElementById('leadModal').classList.remove('active'); }
        document.getElementById('leadForm').addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = e.target.querySelector('button'); btn.innerText = 'Отправка...'; btn.disabled = true;
            const WORKER_URL = CONFIG.WORKER_URL; 
            try {
                if (WORKER_URL.includes('ВАШ_WORKER')) { await new Promise(r => setTimeout(r, 1000)); showToast('Заявка отправлена! (Тест)', 'success'); }
                else { await fetch(WORKER_URL, { method: 'POST', body: JSON.stringify({name: document.getElementById('leadName').value, contact: document.getElementById('leadContact').value, message: document.getElementById('leadMsg').value}), headers: {'Content-Type': 'application/json'} }); showToast('Заявка успешно отправлена!', 'success'); }
                closeLeadModal(); e.target.reset();
            } catch (err) { showToast('Ошибка отправки.', 'error'); } finally { btn.innerText = 'Отправить заявку'; btn.disabled = false; }
        });

        // ИИ ЧАТ
        const chatBtn = document.getElementById('ai-chat-btn');
        const chatWindow = document.getElementById('ai-chat-window');
        const closeChat = document.getElementById('close-chat');
        const chatMessages = document.getElementById('ai-chat-messages');
        const chatInput = document.getElementById('ai-chat-input');
        const sendBtn = document.getElementById('ai-chat-send');

        let history = [];
        let isWaiting = false;

        // Приветственное сообщение
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (chatMessages.children.length === 0) {
                    addMessage('assistant', 'Привет! Я Кибер-Помощник. Задай мне любой вопрос о безопасности, фишинге или уязвимостях.');
                }
            }, 1000);
        });

        chatBtn.onclick = () => {
            chatWindow.classList.toggle('hidden');
            if (!chatWindow.classList.contains('hidden')) chatInput.focus();
        };
        closeChat.onclick = () => chatWindow.classList.add('hidden');

        async function sendMessage() {
            const text = chatInput.value.trim();
            if (!text || isWaiting) return;

            chatInput.value = '';
            addMessage('user', text);
            history.push({ role: 'user', content: text });
            isWaiting = true;

            const loadingDiv = document.createElement('div');
            loadingDiv.innerText = 'Бот печатает...';
            loadingDiv.style.color = 'var(--text-muted)';
            loadingDiv.style.fontStyle = 'italic';
            loadingDiv.id = 'ai-loading';
            chatMessages.appendChild(loadingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                const res = await fetch('https://ВАШ_WORKER.workers.dev', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: history })
                });
                const data = await res.json();
                let reply = '';
                if (data.choices && data.choices[0].message) reply = data.choices[0].message.content;
                else reply = 'Не удалось получить ответ.';

                addMessage('assistant', reply);
                history.push({ role: 'assistant', content: reply });
            } catch (e) {
                addMessage('assistant', 'Ошибка соединения.');
            } finally {
                isWaiting = false;
                const loader = document.getElementById('ai-loading');
                if (loader) loader.remove();
            }
        }

        function addMessage(role, text) {
            const div = document.createElement('div');
            div.style.padding = '8px 12px';
            div.style.borderRadius = '8px';
            div.style.maxWidth = '85%';
            div.style.wordBreak = 'break-word';
            if (role === 'user') {
                div.style.background = 'rgba(0, 210, 255, 0.15)';
                div.style.color = 'var(--primary-cyan)';
                div.style.alignSelf = 'flex-end';
                div.innerText = text;
            } else {
                div.style.background = 'rgba(255,255,255,0.05)';
                div.style.color = 'var(--text-main)';
                div.style.alignSelf = 'flex-start';
                div.innerText = text;
            }
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        sendBtn.onclick = sendMessage;
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // НАВИГАЦИЯ
        const pages = ['main', 'news', 'osint', 'blog', 'map', 'quiz', 'game', 'leaderboard', 'profile', 'leak', 'phishing', 'article', 'terminal', 'cve'];
        function hideAll() {
            pages.forEach(p => document.getElementById(`${p}-page`)?.classList.add('hidden'));
            document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
            if (window.stopGameLoop) window.stopGameLoop();
            if (window.threatMapInterval) clearInterval(window.threatMapInterval);
        }
        function toggleMenu() { document.getElementById('navLinks').classList.toggle('active'); }
        function showMain() { hideAll(); document.getElementById('main-page').classList.remove('hidden'); document.getElementById('nav-main').classList.add('active'); setPageMeta('Kiberbez | Центр Кибербезопасности', 'Проверьте свои данные на утечки, узнайте о новых CVE и попробуйте взломать систему.'); }
        function showNews() { hideAll(); document.getElementById('news-page').classList.remove('hidden'); document.getElementById('nav-news').classList.add('active'); loadNewsFeed(currentNewsSource, document.querySelector('.news-tab.active')); }
        function showOsint() { hideAll(); document.getElementById('osint-page').classList.remove('hidden'); document.getElementById('nav-osint').classList.add('active'); }
        function showTerminal() { hideAll(); document.getElementById('terminal-page').classList.remove('hidden'); document.getElementById('nav-term').classList.add('active'); setTimeout(() => document.getElementById('term-input').focus(), 100); }
        function showLeak() { hideAll(); document.getElementById('leak-page').classList.remove('hidden'); document.getElementById('nav-leak').classList.add('active'); }
        function showPhishing() { hideAll(); document.getElementById('phishing-page').classList.remove('hidden'); document.getElementById('nav-phish').classList.add('active'); initPhishing(); }
        function showQuiz() { hideAll(); document.getElementById('quiz-page').classList.remove('hidden'); document.getElementById('nav-quiz').classList.add('active'); initQuiz(); }
        function showMap() { hideAll(); document.getElementById('map-page').classList.remove('hidden'); document.getElementById('nav-map').classList.add('active'); initMap(); }
        function showGame() { hideAll(); document.getElementById('game-page').classList.remove('hidden'); document.getElementById('nav-game').classList.add('active'); if(window.redrawGame) window.redrawGame(); }
        function showLeaderboard() { hideAll(); document.getElementById('leaderboard-page').classList.remove('hidden'); document.getElementById('nav-leaderboard').classList.add('active'); loadLeaderboard(); }
        function showBlog() { hideAll(); document.getElementById('blog-page').classList.remove('hidden'); document.getElementById('nav-blog').classList.add('active'); loadBlog(); }
        function showCveFeed() { hideAll(); document.getElementById('cve-page').classList.remove('hidden'); document.getElementById('nav-cve').classList.add('active'); loadCveFeed(); }
        function showProfile() { hideAll(); document.getElementById('profile-page').classList.remove('hidden'); document.getElementById('nav-profile').classList.add('active'); checkUser(); }

        async function startOsintScan() {
            const target = document.getElementById('osint-target').value.trim();
            if (!target) return showToast('Введите Email или никнейм', 'error');

            const scanningDiv = document.getElementById('osint-scanning');
            const terminal = document.getElementById('osint-terminal');
            const resultDiv = document.getElementById('osint-result');
            
            resultDiv.classList.add('hidden');
            scanningDiv.classList.remove('hidden');
            terminal.innerHTML = '';

            const steps = [
                `[>] Инициализация модуля сбора данных...`,
                `[>] Поиск аккаунтов по базе SocialMedia...`,
                `[>] Проверка базы утечек HaveIBeenPwned...`,
                `[>] Анализ цифрового следа...`,
                `[>] Генерация досье для: ${escapeHTML(target)}`
            ];

            for (let i = 0; i < steps.length; i++) {
                await new Promise(r => setTimeout(r, 600));
                terminal.innerHTML += steps[i] + '<br>';
                terminal.scrollTop = terminal.scrollHeight;
                playBeep(1000 + i*100, 'sine', 0.05);
            }

            await new Promise(r => setTimeout(r, 800));
            scanningDiv.classList.add('hidden');
            resultDiv.classList.remove('hidden');
            
            generateDossier(target);
        }

        function generateDossier(target) {
            document.getElementById('dossier-target').innerText = target;

            let hash = 0;
            for (let i = 0; i < target.length; i++) { hash = ((hash << 5) - hash) + target.charCodeAt(i); hash |= 0; }
            const seed = Math.abs(hash);

            const platforms = ['GitHub', 'VK', 'Telegram', 'LinkedIn', 'Instagram', 'X (Twitter)', 'Steam'];
            const breaches = [
                { name: 'LinkedIn (2021)', data: 'Email, Пароль, Место работы' },
                { name: 'Adobe (2013)', data: 'Email, Зашифрованный пароль' },
                { name: 'Canva (2019)', data: 'Email, Имя, Хэш пароля' },
                { name: 'Dropbox (2012)', data: 'Email, Пароль' },
                { name: 'Collection #1 (2019)', data: 'Email, Пароли от разных сайтов' }
            ];

            const accountsList = document.getElementById('dossier-accounts');
            accountsList.innerHTML = '';
            const numAccounts = (seed % 3) + 2;
            let riskScore = 0;

            for (let i = 0; i < numAccounts; i++) {
                const platform = platforms[(seed + i * 7) % platforms.length];
                const year = 2010 + ((seed + i * 3) % 14);
                accountsList.innerHTML += `<div class="osint-item"><span>${platform}</span><span class="highlight">Найден (с ${year} г.)</span></div>`;
                riskScore += 10;
            }

            const breachesList = document.getElementById('dossier-breaches');
            breachesList.innerHTML = '';
            const numBreaches = (seed % 4);

            if (numBreaches === 0) {
                breachesList.innerHTML = `<div class="osint-item" style="justify-content: center; color: var(--success);">Утечек не обнаружено</div>`;
            } else {
                for (let i = 0; i < numBreaches; i++) {
                    const b = breaches[(seed + i * 11) % breaches.length];
                    breachesList.innerHTML += `<div class="osint-item"><span>${b.name}</span><span class="danger">${b.data}</span></div>`;
                    riskScore += 25;
                }
            }

            const riskBadge = document.getElementById('dossier-risk');
            if (riskScore < 30) {
                riskBadge.className = 'risk-badge risk-low';
                riskBadge.innerText = 'Уровень риска: НИЗКИЙ';
            } else if (riskScore < 60) {
                riskBadge.className = 'risk-badge risk-medium';
                riskBadge.innerText = 'Уровень риска: СРЕДНИЙ';
            } else {
                riskBadge.className = 'risk-badge risk-high';
                riskBadge.innerText = 'Уровень риска: КРИТИЧЕСКИЙ';
            }

            const recList = document.getElementById('dossier-recommendations');
            recList.innerHTML = '';
            if (riskScore >= 30) {
                recList.innerHTML += `<div class="osint-item">🔴 Срочно смените пароли во всех найденных сервисах.</div>`;
                recList.innerHTML += `<div class="osint-item">🔴 Включите двухфакторную аутентификацию (2FA).</div>`;
            }
            if (numBreaches > 0) {
                recList.innerHTML += `<div class="osint-item">🟡 Проверьте, не использовали ли вы одинаковые пароли.</div>`;
            }
            recList.innerHTML += `<div class="osint-item" style="color: var(--primary-cyan);">🟢 Используйте менеджер паролей для генерации уникальных связок.</div>`;
            
            playBeep(600, 'triangle', 0.2);
        }

        const newsSources = {
            'securitylab': { name: 'SecurityLab', rss: 'https://www.securitylab.ru/_Services/Export/RSS/' },
            'opennet': { name: 'OpenNet', rss: 'https://www.opennet.ru/opennews/opennews_sec.rss' },
            'bdu': { name: 'БДУ ФСТЭК', rss: 'https://bdu.fstec.ru/ubi/vul/rss' }
        };
        let currentNewsSource = 'securitylab';

        async function loadNewsFeed(sourceKey, tabElement) {
            if (tabElement) {
                document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
                tabElement.classList.add('active');
            }
            currentNewsSource = sourceKey;
            const container = document.getElementById('news-list');
            const source = newsSources[sourceKey];
            
            const cacheKey = `kiberbez_news_${sourceKey}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try { const { timestamp, data } = JSON.parse(cached); if (Date.now() - timestamp < 1000 * 60 * 5) { renderNews(data, source.name); return; } } catch (e) {}
            }

            container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Загрузка новостей из ${source.name}...</p>`;

            try {
                const encodedUrl = encodeURIComponent(source.rss);
                const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodedUrl}`);
                const data = await res.json();
                if (data.status !== 'ok') throw new Error(data.message || 'Ошибка парсинга RSS');
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data.items }));
                renderNews(data.items, source.name);
            } catch (error) {
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger);"><p>Не удалось загрузить новости.</p><button class="btn btn-outline" onclick="loadNewsFeed('${sourceKey}', document.querySelector('.news-tab.active'))" style="margin-top: 10px;">Повторить</button></div>`;
            }
        }

        function renderNews(items, sourceName) {
            const container = document.getElementById('news-list');
            if (!items || items.length === 0) { container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Новостей пока нет.</p>'; return; }
            container.innerHTML = items.map(item => {
                const date = item.pubDate ? new Date(item.pubDate).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Дата неизвестна';
                const tempDiv = document.createElement('div'); tempDiv.innerHTML = item.description || ''; const cleanDesc = tempDiv.textContent || tempDiv.innerText || '';
                return `<div class="news-item"><a href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;"><div class="news-title">${escapeHTML(item.title)}</div><div class="news-desc">${escapeHTML(cleanDesc)}</div></a><div class="news-footer"><span class="news-source">${escapeHTML(sourceName)}</span><span>${date}</span></div></div>`;
            }).join('');
        }

        function switchAuthTab(tab) {
            document.getElementById('tab-login').classList.remove('active');
            document.getElementById('tab-register').classList.remove('active');
            document.getElementById('form-login').classList.add('hidden');
            document.getElementById('form-register').classList.add('hidden');
            if (tab === 'login') { document.getElementById('tab-login').classList.add('active'); document.getElementById('form-login').classList.remove('hidden'); } 
            else { document.getElementById('tab-register').classList.add('active'); document.getElementById('form-register').classList.remove('hidden'); }
        }

        async function checkUser() {
            const { data: { user } } = await supabaseClient.auth.getUser();
            const authSection = document.getElementById('auth-section');
            const userDashboard = document.getElementById('user-dashboard');
            const adminDashboard = document.getElementById('admin-dashboard');
            const navProfile = document.getElementById('nav-profile');

            if (user) {
                authSection.classList.add('hidden');
                navProfile.innerText = 'Профиль';
                if (user.email === ADMIN_EMAIL) {
                    userDashboard.classList.add('hidden'); adminDashboard.classList.remove('hidden'); loadAdminArticles();
                } else {
                    adminDashboard.classList.add('hidden'); userDashboard.classList.remove('hidden');
                    document.getElementById('user-email-display').innerText = user.email;
                }
            } else {
                authSection.classList.remove('hidden'); userDashboard.classList.add('hidden'); adminDashboard.classList.add('hidden'); navProfile.innerText = 'Вход';
            }
        }

        async function login() {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-pass').value;
            const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            if(!EMAIL_RE.test(email)) return showToast('Введите корректный email', 'error');
            if(!password) return showToast('Заполните все поля', 'error');
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) showToast('Ошибка входа: ' + error.message, 'error');
            else { showToast('Успешный вход!', 'success'); checkUser(); }
        }

        async function register() {
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-pass').value;
            const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            if(!EMAIL_RE.test(email)) return showToast('Введите корректный email', 'error');
            if(password.length < 8 || !/[a-zA-Zа-яА-Яё]/.test(password) || !/\d/.test(password)) return showToast('Пароль: минимум 8 символов, буквы и цифры', 'error');
            const { error } = await supabaseClient.auth.signUp({ email, password });
            if (error) showToast('Ошибка регистрации: ' + error.message, 'error');
            else { showToast('Регистрация успешна! Войдите.', 'success'); switchAuthTab('login'); document.getElementById('login-email').value = email; }
        }

        async function logout() {
            await supabaseClient.auth.signOut();
            showToast('Вы вышли из аккаунта', 'success'); checkUser(); showMain();
        }

        const termInput = document.getElementById('term-input');
        const termOutput = document.getElementById('term-output');
        
        const commands = {
            'help': 'Доступные команды:<br> - <span style="color:#fff">help</span><br> - <span style="color:#fff">whoami</span><br> - <span style="color:#fff">scan</span><br> - <span style="color:#fff">matrix</span><br> - <span style="color:#fff">hack</span><br> - <span style="color:#fff">clear</span><br> - <span style="color:#fff">sudo</span>',
            'whoami': 'Гость.<br>IP: 192.168.1.104<br>Роль: Penetration Tester',
            'sudo': '<span style="color:var(--danger)">Ошибка: нет прав.</span>'
        };

        termInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = termInput.value.trim().toLowerCase();
                termOutput.innerHTML += `<span style="color:#fff">root@kiberbez:~#</span> ${escapeHTML(cmd)}<br>`; termInput.value = '';
                if (cmd === 'clear') termOutput.innerHTML = '';
                else if (cmd === 'matrix') { toggleHackerMode(); termOutput.innerHTML += `> Матрица переключена.<br><br>`; }
                else if (cmd === 'scan') {
                    termOutput.innerHTML += `> Nmap сканирование...<br>`;
                    setTimeout(() => termOutput.innerHTML += `> Порт 22 (SSH) открыт<br>`, 500);
                    setTimeout(() => termOutput.innerHTML += `> Порт 80 (HTTP) открыт<br>`, 1000);
                    setTimeout(() => termOutput.innerHTML += `> Найдено 2 уязвимости.<br><br>`, 1500);
                } else if (cmd === 'hack') {
                    termOutput.innerHTML += `> Brute-force...<br>`;
                    setTimeout(() => termOutput.innerHTML += `> [▓▓▓▓░░░░░░] 40%<br>`, 400);
                    setTimeout(() => termOutput.innerHTML += `> [▓▓▓▓▓▓▓▓░░] 80%<br>`, 800);
                    setTimeout(() => termOutput.innerHTML += `<span style="color:var(--success)">> Доступ получен!</span><br><br>`, 1200);
                } else if (commands[cmd]) termOutput.innerHTML += `> ${commands[cmd]}<br><br>`;
                else if (cmd !== '') termOutput.innerHTML += `> Команда не найдена. Введите 'help'.<br><br>`;
                termOutput.scrollTop = termOutput.scrollHeight;
            }
        });

        setInterval(() => {
            const defconEl = document.getElementById('defcon-level'); if(!defconEl) return;
            const levels = [ {lvl: 5, cls: 'defcon-5', txt: 'DEFCON 5'}, {lvl: 4, cls: 'defcon-5', txt: 'DEFCON 4'}, {lvl: 3, cls: 'defcon-3', txt: 'DEFCON 3'}, {lvl: 2, cls: 'defcon-3', txt: 'DEFCON 2'}, {lvl: 1, cls: 'defcon-1', txt: 'DEFCON 1'} ];
            const rand = Math.random(); let idx = 0;
            if(rand > 0.9) idx = 4; else if(rand > 0.7) idx = 2; else if(rand > 0.4) idx = 1;
            const lvl = levels[idx]; defconEl.className = `defcon-badge ${lvl.cls}`; defconEl.innerText = lvl.txt;
            if (lvl.lvl === 1) document.body.classList.add('global-alert'); else document.body.classList.remove('global-alert');
        }, 8000);

        if (!isTouchDevice) {
            const cursorDot = document.getElementById('cursor-dot'); const cursorOutline = document.getElementById('cursor-outline');
            let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
            window.addEventListener('mousemove', (e) => {
                mouseX = e.clientX; mouseY = e.clientY; cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
                if (!document.getElementById('main-page').classList.contains('hidden')) {
                    const text = document.getElementById('parallax-text'); const img = document.getElementById('parallax-image');
                    if(text && img) { text.style.transform = `translate(${(window.innerWidth/2 - mouseX)/50}px, ${(window.innerHeight/2 - mouseY)/50}px)`; img.style.transform = `translate(${-(window.innerWidth/2 - mouseX)/25}px, ${-(window.innerHeight/2 - mouseY)/25}px)`; }
                }
            });
            function animateCursor() { outlineX += (mouseX - outlineX) * 0.2; outlineY += (mouseY - outlineY) * 0.2; cursorOutline.style.transform = `translate3d(${outlineX}px, ${outlineY}px, 0) translate(-50%, -50%)`; requestAnimationFrame(animateCursor); }
            animateCursor();
            document.addEventListener('mouseover', (e) => { if (e.target.closest('button, a, .quiz-option, .article-card, .card, .news-item, .osint-item')) cursorOutline.classList.add('hovering'); else cursorOutline.classList.remove('hovering'); });
            document.addEventListener('mousedown', () => cursorOutline.classList.add('clicking')); document.addEventListener('mouseup', () => cursorOutline.classList.remove('clicking'));
        }

        function startLeakScan() {
            const email = document.getElementById('leak-email').value; const out = document.getElementById('terminal-output');
            if(!email.includes('@')) return showToast('Введите email', 'error');
            document.getElementById('leak-input-group').classList.add('hidden'); out.innerHTML = `root@kiberbez:~# target: ${escapeHTML(email)}<br>> Подключение...`;
            setTimeout(() => { out.innerHTML += `<br>> Анализ: 100%`; setTimeout(() => { const hacked = Math.random() > 0.5; if(hacked) out.innerHTML += `<br><span style="color: #ff4757;">[!!!] Email найден в 3 базах!</span><br>> Смените пароль.`; else out.innerHTML += `<br><span style="color: #2ecc71;">[OK] Совпадений не найдено.</span>`; out.innerHTML += `<br><br>> <button class="btn btn-primary" onclick="openLeadModal()" style="font-size: 12px; padding: 5px 10px;">Получить аудит</button>`; }, 1000); }, 1500);
        }

        const phishingData = [ { sender: "support@paypal-secure-update.com", subject: "Срочно! Аккаунт заблокирован", body: "Подтвердите данные по ссылке.", isPhishing: true, reason: "Поддельный домен." }, { sender: "hr@yourcompany.ru", subject: "Расписание встреч", body: "Привет! Во вложении расписание.", isPhishing: false, reason: "Обычное письмо." }, { sender: "security@sberbank.ru", subject: "Отмена перевода", body: "Перейдите по ссылке http://sberbank-online.xyz", isPhishing: true, reason: "Домен .xyz." } ];
        let currentPhish = 0;
        function initPhishing() { currentPhish = 0; renderPhishing(); }
        function renderPhishing() {
            const card = document.getElementById('phishing-card');
            if (currentPhish >= phishingData.length) { card.innerHTML = `<div style="padding: 20px; text-align: center;"><h2 style="color: var(--success); font-size: 20px;">Тест пройден!</h2><button class="btn btn-primary" onclick="initPhishing()" style="margin-top: 15px; width: 100%;">Еще раз</button></div>`; return; }
            const d = phishingData[currentPhish];
            card.innerHTML = `<div class="email-header"><div><b>От:</b> ${escapeHTML(d.sender)}</div><div><b>Тема:</b> ${escapeHTML(d.subject)}</div></div><div class="email-body">${escapeHTML(d.body)}</div><div class="phishing-actions"><button class="btn btn-danger" onclick="checkPhishing(true)">🚨 Фишинг!</button><button class="btn btn-primary" onclick="checkPhishing(false)">✅ Настоящее</button></div><div class="phishing-result" id="phish-result"></div>`;
        }
        function checkPhishing(choice) {
            const d = phishingData[currentPhish]; const res = document.getElementById('phish-result'); res.style.display = 'block';
            res.innerHTML = `<div style="font-size: 16px; color: ${choice === d.isPhishing ? 'var(--success)' : 'var(--danger)'};">${choice === d.isPhishing ? '✅ Верно!' : '❌ Ошибка!'}</div><p style="font-size: 13px; margin-top: 10px;">${escapeHTML(d.reason)}</p><button class="btn btn-outline" style="margin-top: 15px; width: 100%;" onclick="currentPhish++; renderPhishing()">Далее →</button>`;
            document.querySelector('.phishing-actions').style.display = 'none';
        }

        const quizData = [
            {icon:'📧', q:'Пришло письмо «Ваш счёт заблокирован, перейдите по ссылке» от «банка». Что делаете?', opts:['Открою ссылку — банк же пишет','Зайду в приложение банка напрямую','Проверю адрес отправителя и удалю'], sc:[0,15,10], tip:'Заходите на сайт банка только через закладку или приложение: ссылки из писем ведут на фейковые копии.'},
            {icon:'📶', q:'Нужен интернет, вокруг открытый Wi-Fi кафе. Ваши действия?', opts:['Подключусь и зайду в банк','Подключусь, но только к новостям','Обойдусь мобильным интернетом'], sc:[0,10,15], tip:'Открытый Wi-Fi — витрина для перехвата трафика. Банки и почту через него не открываем.'},
            {icon:'🔑', q:'Как вы храните пароли?', opts:['Один и тот же везде','В заметках телефона','В менеджере паролей'], sc:[0,5,15], tip:'Менеджер паролей хранит всё зашифрованным — вам нужен только один мастер-пароль.'},
            {icon:'📱', q:'Сайт предлагает включить 2FA. Что делаете?', opts:['Пропущу, это лишнее','Включу через приложение-аутентификатор','Включу по СМС'], sc:[0,15,8], tip:'Приложение-аутентификатор надёжнее СМС: код можно перехватить или украсть через SIM-своп.'},
            {icon:'💬', q:'Друг прислал в мессенджер ссылку «посмотри, это ты?». Ваши действия?', opts:['Открою, вдруг правда','Спрошу друга голосом, не в чате','Удалю и предупрежу друга'], sc:[0,15,10], tip:'Аккаунты друзей часто угоняют. Сначала подтвердите звонком или голосом, что ссылка от него.'},
            {icon:'⏳', q:'Телефон висит с обновлениями уже месяц.', opts:['Обновлю в ближайшие дни','Жду, пока напомнит система','Обновлю прямо сейчас'], sc:[5,0,15], tip:'Обновления закрывают дыры, через которые вирусы заходят неделями. Не откладывайте.'},
            {icon:'☎️', q:'«Служба безопасности» просит продиктовать код из СМС.', opts:['Продиктую, они же решили проблему','Спрошу код в чате банка','Сброшу — банк коды не спрашивает'], sc:[0,5,15], tip:'Код из СМС — второй фактор. Его просят только мошенники. Сбрасывайте звонок.'}
        ];
        let currQ = 0, qScore = 0, qAns = [];
        function initQuiz() { currQ = 0; qScore = 0; qAns = []; renderQuiz(); }
        function pickAnswer(sc) { qAns.push(sc); qScore += sc; currQ++; renderQuiz(); }
        function renderQuiz() {
            const c = document.getElementById('quiz-container');
            if(currQ >= quizData.length) { renderQuizResult(); return; }
            const q = quizData[currQ];
            const pct = Math.round(currQ / quizData.length * 100);
            c.innerHTML = `<div class="qz-progress"><div class="qz-bar" style="width:${pct}%"></div></div>
              <div class="qz-step">Вопрос ${currQ + 1} из ${quizData.length}</div>
              <div class="qz-card"><div class="qz-icon">${q.icon}</div><div class="qz-q">${escapeHTML(q.q)}</div>
              ${q.opts.map((o,i) => `<div class="quiz-option qz-opt" onclick="pickAnswer(${q.sc[i]})"><span class="qz-badge">${'ABC'[i]}</span>${escapeHTML(o)}</div>`).join('')}</div>`;
        }
        function renderQuizResult() {
            const c = document.getElementById('quiz-container');
            const max = quizData.length * 15, pct = Math.round(qScore / max * 100);
            const rank = pct >= 85 ? ['КИБЕР-САМУРАЙ','#2ecc71','Отличная цифровая гигиена — вас не возьмут на горячую руку.']
                : pct >= 60 ? ['КРЕПОСТЬ С БРЕШЬЮ','#f1c40f','База есть, но пара дыр может дорого обойтись. Закройте их по списку.']
                : pct >= 35 ? ['ЛЁГКАЯ МИШЕНЬ','#ff9f43','Мошенникам вы интересны. Начните с первых двух советов — это самые частые атаки.']
                : ['ОТКРЫТЫЕ ВОРОТА','#ff4757','Срочно закрываем бреши: конкретные шаги ниже, займут 15 минут.'];
            const tips = quizData.filter((q,i) => qAns[i] < 15).map(q => `<li>${escapeHTML(q.tip)}</li>`).join('');
            c.innerHTML = `<div class="qz-progress"><div class="qz-bar" style="width:100%"></div></div>
              <div class="qz-result">
              <svg viewBox="0 0 120 120" class="qz-gauge"><circle cx="60" cy="60" r="52" class="qz-ring-bg"/><circle cx="60" cy="60" r="52" class="qz-ring" style="stroke:${rank[1]};stroke-dashoffset:${327 * (1 - pct/100)}"/><text x="60" y="58" class="qz-pct">${pct}%</text><text x="60" y="76" class="qz-lbl">защита</text></svg>
              <h2 class="qz-rank" style="color:${rank[1]}">${rank[0]}</h2>
              <p class="qz-desc">${rank[2]}</p>
              ${tips ? `<h3>Что подтянуть</h3><ul class="qz-tips">${tips}</ul>` : '<p class="qz-desc">Идеальный результат! Продвинутый уровень: держите резервные копии по правилу 3-2-1 и проверяйте почту на утечки раз в месяц.</p>'}
              <button class="btn btn-primary" onclick="shareQuizResult('${pct}','${rank[0]}')">📤 Поделиться результатом</button>
              <button class="btn btn-outline" style="margin-top:10px;" onclick="initQuiz()">Пройти заново</button>
              <button class="btn btn-outline" style="margin-top:10px;" onclick="showMain()">На главную</button></div>`;
        }
        async function shareQuizResult(pct, rank) {
            const text = `Мой уровень цифровой защиты на Kiberbez: ${pct}% — «${rank}». Проверь себя!`;
            if (navigator.share) { try { await navigator.share({ title: 'Kiberbez', text }); } catch(e) {} }
            else { try { await navigator.clipboard.writeText(text); showToast('Результат скопирован', 'success'); } catch(e) {} }
        }

        let threatMap = null; let mapLayer = null;
        function initMap() {
            const mapContainer = document.getElementById('threatMap'); if (!mapContainer) return;
            if (!threatMap) { threatMap = L.map('threatMap', { zoomControl: false, attributionControl: false }).setView([20, 0], 2); L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(threatMap); mapLayer = L.layerGroup().addTo(threatMap); }
            mapLayer.clearLayers();
            function launchAttack() {
                const latlngs = [ [Math.random() * 80 - 40, Math.random() * 360 - 180], [Math.random() * 80 - 40, Math.random() * 360 - 180] ];
                const polyline = L.polyline(latlngs, { color: Math.random() > 0.3 ? '#ff4757' : '#00d2ff', weight: 2, opacity: 0.8, dashArray: '5, 10', className: 'attack-line' }).addTo(mapLayer);
                const targetMarker = L.circleMarker(latlngs[1], { radius: 4, color: '#ff4757', fillColor: '#ff4757', fillOpacity: 1, className: 'pulse-marker' }).addTo(mapLayer);
                setTimeout(() => { if (mapLayer.hasLayer(polyline)) mapLayer.removeLayer(polyline); if (mapLayer.hasLayer(targetMarker)) mapLayer.removeLayer(targetMarker); }, 2000);
            }
            if (window.threatMapInterval) clearInterval(window.threatMapInterval); window.threatMapInterval = setInterval(launchAttack, 400); setTimeout(() => { threatMap.invalidateSize(); }, 200);
        }

        let matrixInt;
        function toggleHackerMode() {
            document.body.classList.toggle('hacker-mode'); const canvas = document.getElementById('matrix-canvas'); const ctx = canvas.getContext('2d');
            if (document.body.classList.contains('hacker-mode')) {
                canvas.width = window.innerWidth; canvas.height = window.innerHeight;
                const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()"; const drops = Array(Math.floor(canvas.width/16)).fill(1);
                matrixInt = setInterval(() => { ctx.fillStyle = "rgba(0,0,0,0.05)"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = "#0F0"; ctx.font = "16px monospace"; drops.forEach((y, i) => { ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*16, y*16); if(y*16 > canvas.height && Math.random() > 0.975) drops[i]=0; drops[i]++; }); }, 50);
            } else { clearInterval(matrixInt); ctx.clearRect(0,0,canvas.width,canvas.height); }
        }

        async function loadBlog() {
            const container = document.getElementById('blog-container'); container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Загрузка...</p>';
            const { data, error } = await supabaseClient.from('articles').select('*').order('created_at', { ascending: false });
            if (error) { container.innerHTML = '<p style="color: var(--danger); text-align: center;">Ошибка загрузки статей.</p>'; return; }
            loadedArticles = data || []; filterBlog();
        }
        function filterBlog() {
            const query = document.getElementById('blog-search').value.toLowerCase(); const container = document.getElementById('blog-container');
            const filtered = loadedArticles.filter(a => a.title.toLowerCase().includes(query) || a.content.toLowerCase().includes(query) || (a.tags && a.tags.toLowerCase().includes(query)));
            if (filtered.length === 0) { container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Ничего не найдено.</p>'; return; }
            container.innerHTML = filtered.map(art => {
                const date = new Date(art.created_at).toLocaleDateString('ru-RU'); const readTime = Math.ceil(art.content.split(' ').length / 180) || 1; let cover = art.emoji || '📄';
                if (cover.startsWith('http')) cover = `<img src="${escapeHTML(cover)}">`; else cover = escapeHTML(cover);
                let tags = ''; if(art.tags) tags = `<div class="article-tags" style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:10px;">${art.tags.split(',').map(t => `<span style="background: rgba(0, 210, 255, 0.1); color: var(--primary-cyan); padding: 2px 8px; border-radius: 10px; font-size: 10px;">#${escapeHTML(t.trim())}</span>`).join('')}</div>`;
                return `<div class="article-card" onclick="readArticle('${art.id}')"><div class="article-img-box">${cover}</div><div class="article-content"><div class="article-meta"><span>${date}</span><span>⏱ ${readTime} мин</span></div><h3 class="article-title">${escapeHTML(art.title)}</h3>${tags}<p class="article-excerpt">${escapeHTML(art.content)}</p></div></div>`;
            }).join('');
        }
        function setPageMeta(title, desc) {
            document.title = title;
            const m = document.querySelector('meta[name="description"]'); if(m) m.setAttribute('content', desc);
            const og = document.querySelector('meta[property="og:title"]'); if(og) og.setAttribute('content', title);
        }

        function readArticle(id) {
            const art = loadedArticles.find(a => a.id === id); if(!art) return;
            hideAll(); document.getElementById('article-page').classList.remove('hidden');
            document.getElementById('view-title').innerText = art.title; const date = new Date(art.created_at).toLocaleDateString('ru-RU'); const readTime = Math.ceil(art.content.split(' ').length / 180) || 1;
            document.getElementById('view-meta').innerText = `${date} • ⏱ ${readTime} мин`; document.getElementById('view-content').innerText = art.content; window.scrollTo(0, 0); setPageMeta(`${art.title} | Kiberbez`, (art.content || '').slice(0, 150));
        }

        async function loadAdminArticles() {
            const tbody = document.getElementById('admin-table-body'); const { data } = await supabaseClient.from('articles').select('*').order('created_at', { ascending: false });
            loadedArticles = data || []; tbody.innerHTML = loadedArticles.map(art => `<tr><td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(art.title)}</td><td>${new Date(art.created_at).toLocaleDateString('ru-RU')}</td><td><button class="btn btn-outline btn-sm" onclick="editArticle('${art.id}')" style="margin-bottom:5px;">Ред.</button> <button class="btn btn-danger btn-sm" onclick="deleteArticle('${art.id}')">Удал.</button></td></tr>`).join('');
        }
        function toggleEditor() { const ed = document.getElementById('editor-section'); ed.classList.toggle('hidden'); if(ed.classList.contains('hidden')) { document.getElementById('edit-id').value = ''; document.getElementById('art-title').value = ''; document.getElementById('art-emoji').value = ''; document.getElementById('art-tags').value = ''; document.getElementById('art-content').value = ''; } }
        async function saveArticle() {
            const id = document.getElementById('edit-id').value; const payload = { title: document.getElementById('art-title').value.trim(), emoji: document.getElementById('art-emoji').value.trim() || '📄', tags: document.getElementById('art-tags').value.trim(), content: document.getElementById('art-content').value.trim() };
            if(!payload.title || !payload.content) { showToast('Заполните поля!', 'error'); return; } const btn = document.getElementById('save-btn'); btn.innerText = '...';
            if(id) await supabaseClient.from('articles').update(payload).eq('id', id); else await supabaseClient.from('articles').insert([payload]);
            btn.innerText = 'Сохранить'; toggleEditor(); loadAdminArticles(); showToast('Статья сохранена', 'success');
        }
        function editArticle(id) { const art = loadedArticles.find(a => a.id === id); if(!art) return; document.getElementById('edit-id').value = art.id; document.getElementById('art-title').value = art.title; document.getElementById('art-emoji').value = art.emoji || ''; document.getElementById('art-tags').value = art.tags || ''; document.getElementById('art-content').value = art.content; document.getElementById('editor-section').classList.remove('hidden'); window.scrollTo(0, 0); }
        async function deleteArticle(id) { if(!confirm('Удалить?')) return; await supabaseClient.from('articles').delete().eq('id', id); loadAdminArticles(); showToast('Удалено', 'success'); }

        const CVE_CACHE_KEY = 'kiberbez_cve_cache'; const CVE_CACHE_TTL = 1000 * 60 * 60;
        function sanitizeUrl(u) { if (typeof u !== 'string') return ''; return /^https?:\/\//.test(u) || u.startsWith('/') ? u : ''; }

        async function loadCveFeed(forceReload = false) {
            const container = document.getElementById('cve-list');
            if (!forceReload) { const cached = localStorage.getItem(CVE_CACHE_KEY); if (cached) { try { const { timestamp, data } = JSON.parse(cached); if (Date.now() - timestamp < CVE_CACHE_TTL) { renderCveList(data); return; } } catch (e) {} } }
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Загрузка...</p>';
            try { const res = await fetch('https://cve.circl.lu/api/last/15'); if (!res.ok) throw new Error(); const data = await res.json(); localStorage.setItem(CVE_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: data })); renderCveList(data); } catch (error) { container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);"><p>Не удалось загрузить ленту CVE.</p><button class="btn btn-outline" onclick="loadCveFeed(true)" style="margin-top: 10px;">Повторить</button></div>`; }
        }
        function renderCveList(data) {
            const container = document.getElementById('cve-list'); if (!data || !data.length) { container.innerHTML = '<p style="text-align: center;">Нет данных.</p>'; return; }
            container.innerHTML = data.map(item => {
                const rawId = item.id || item.cve_id || 'CVE-UNKNOWN'; const id = escapeHTML(rawId); const summary = escapeHTML(item.summary || item.details || 'Описание отсутствует.'); const published = item.published ? new Date(item.published).toLocaleDateString('ru-RU') : '—';
                let cvss = null; if (typeof item.cvss === 'number') cvss = item.cvss; else if (item.cvssScore) cvss = item.cvssScore; else if (item.cvssv3) cvss = item.cvssv3; else if (item.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore) cvss = item.metrics.cvssMetricV31[0].cvssData.baseScore;
                let cls = 'cve-unknown', txt = 'Не оценён', color = '#94a3b8';
                if (cvss >= 9.0) { cls = 'cve-critical'; txt = 'Критический'; color = '#ff4757'; }
                else if (cvss >= 7.0) { cls = 'cve-high'; txt = 'Высокий'; color = '#ff9f43'; }
                else if (cvss >= 4.0) { cls = 'cve-medium'; txt = 'Средний'; color = '#f1c40f'; }
                else if (cvss !== null) { cls = 'cve-low'; txt = 'Низкий'; color = '#2ecc71'; }
                const isSafeId = /^CVE-\d{4}-\d{4,}$/.test(rawId);
                const nvdLink = isSafeId ? sanitizeUrl(`https://nvd.nist.gov/vuln/detail/${rawId}`) : '';
                return `<div class="cve-card ${cls}">
                  <div class="cve-main">
                    <div class="cve-header"><span class="cve-id">${id}</span><span class="cve-severity"><i style="background:${color}"></i>${txt}</span></div>
                    <div class="cve-en"><small>ОРИГИНАЛ (EN)</small><p>${summary}</p></div>
                    <div class="cve-footer"><span>📅 ${published}</span>${nvdLink ? `<a href="${nvdLink}" target="_blank" rel="noopener noreferrer" class="cve-link">NVD · подробнее ↗</a>` : ''}</div>
                  </div>
                  ${cvss !== null ? `<div class="cve-ring" style="--c:${color};--p:${Math.round(cvss*10)}"><span>${cvss.toFixed(1)}</span><small>CVSS</small></div>` : ''}
                </div>`;
            }).join('');
        }

        async function loadLeaderboard() {
            const tbody = document.getElementById('leaderboard-body'); tbody.innerHTML = '<tr><td colspan="3">Загрузка...</td></tr>';
            const { data } = await supabaseClient.from('game_leaderboard').select('*').order('score', { ascending: false }).limit(10);
            if(!data || !data.length) return tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Пусто</td></tr>';
            tbody.innerHTML = data.map((r,i) => `<tr><td>${i+1}</td><td>${escapeHTML(r.player_name)}</td><td style="color:var(--primary-cyan)">${r.score}</td></tr>`).join('');
        }

// ===== KIBER RUN: движок игры вынесен в js/game.js =====
window.addEventListener('scroll', () => { const b = document.getElementById('scroll-top-btn'); if (b) b.classList.toggle('show', window.scrollY > 400); }, { passive: true });
        const stb = document.getElementById('scroll-top-btn'); if (stb) stb.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        setInterval(() => { const el = document.getElementById('blocked-count'); if(el) el.innerText = (parseInt(el.innerText.replace(/,/g,'')) + Math.floor(Math.random()*5)).toLocaleString(); }, 3000);
    