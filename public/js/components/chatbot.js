// Widget Chatbot flottant — Olélé Copilot
const Chatbot = {
    messages: [],
    isOpen: false,
    isLoading: false,
    isMaximized: false,
    currentUtterance: null,

    SUGGESTIONS: [
        'Combien de projets sont en retard ?',
        'Quels sont les projets urgents ?',
        'Donne-moi le statut des projets DPGI',
        'Quel est l\'avancement moyen global ?',
        'Quels projets n\'ont pas de budget renseigné ?'
    ],

    init() {
        if (!Auth.isAuthenticated()) return;
        if (document.getElementById('chatbot-root')) return;

        const root = document.createElement('div');
        root.id = 'chatbot-root';
        root.innerHTML = this.renderLauncher() + this.renderPanel();
        document.body.appendChild(root);

        this.attachEvents();
        this.initResize();
    },

    // ==================== Actions sur les messages ====================

    copyMessage(index) {
        const msg = this.messages[index];
        if (!msg) return;
        navigator.clipboard.writeText(msg.content).then(
            () => { if (typeof Toast !== 'undefined') Toast.success('Copié !'); },
            () => { if (typeof Toast !== 'undefined') Toast.error('Échec de la copie'); }
        );
    },

    speakMessage(index) {
        const msg = this.messages[index];
        if (!msg) return;
        if (!('speechSynthesis' in window)) {
            if (typeof Toast !== 'undefined') Toast.warning('Synthèse vocale non supportée par ce navigateur');
            return;
        }

        // Si une lecture est en cours sur ce même message → stopper (toggle)
        if (this.currentUtterance && this.currentUtterance.index === index && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            this.currentUtterance = null;
            this.updateSpeakButton(index, false);
            return;
        }

        // Stopper toute lecture en cours
        window.speechSynthesis.cancel();

        // Nettoyer le markdown pour la lecture vocale
        const clean = msg.content
            .replace(/```[\s\S]*?```/g, ' bloc de code ')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/#{1,6}\s+/g, '')
            .replace(/\|/g, ' ')
            .replace(/[-=]{3,}/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const utter = new SpeechSynthesisUtterance(clean);
        utter.lang = 'fr-FR';
        utter.rate = 1.0;
        utter.pitch = 1.0;

        // Voix française si dispo
        const voices = window.speechSynthesis.getVoices();
        const frVoice = voices.find(v => /fr/i.test(v.lang));
        if (frVoice) utter.voice = frVoice;

        utter.onend = () => {
            this.currentUtterance = null;
            this.updateSpeakButton(index, false);
        };
        utter.onerror = () => {
            this.currentUtterance = null;
            this.updateSpeakButton(index, false);
        };

        this.currentUtterance = { index, utter };
        this.updateSpeakButton(index, true);
        window.speechSynthesis.speak(utter);
    },

    updateSpeakButton(index, isSpeaking) {
        const btn = document.querySelector(`[data-speak-index="${index}"]`);
        if (!btn) return;
        btn.classList.toggle('chat-action-active', isSpeaking);
        btn.title = isSpeaking ? 'Arrêter la lecture' : 'Lire à haute voix';
    },

    AVATAR_IMG: '/icons/chatbot-avatar.png',

    // SVG robot générique (utilisé quand /icons/chatbot-avatar.png n'existe pas)
    fallbackBotSvg(size = 34) {
        const id = `botbg_${size}_${Math.floor(Math.random() * 99999)}`;
        return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#3794C4"/>
                    <stop offset="100%" stop-color="#202B5D"/>
                </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="30" fill="url(#${id})"/>
            <line x1="32" y1="12" x2="32" y2="18" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
            <circle cx="32" cy="11" r="2" fill="#ffffff"/>
            <rect x="18" y="20" width="28" height="22" rx="5" fill="#ffffff"/>
            <circle cx="26" cy="30" r="2.5" fill="#202B5D"/>
            <circle cx="38" cy="30" r="2.5" fill="#202B5D"/>
            <path d="M 25 36 Q 32 40 39 36" stroke="#202B5D" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M 10 50 Q 18 46 26 50 T 42 50 T 54 50" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>`;
    },

    onAvatarError(imgEl, size) {
        imgEl.onerror = null;
        const wrap = document.createElement('span');
        wrap.style.display = 'inline-flex';
        wrap.innerHTML = this.fallbackBotSvg(parseInt(size, 10) || 34);
        imgEl.replaceWith(wrap.firstElementChild);
    },

    renderAvatar(size = 34) {
        // Si l'image a déjà été détectée comme manquante, on met direct le SVG
        if (this._avatarBroken) {
            return this.fallbackBotSvg(size);
        }
        return `<img src="${this.AVATAR_IMG}" alt="Olélé Copilot" width="${size}" height="${size}"
                     data-avatar-size="${size}"
                     onerror="Chatbot._avatarBroken=true;Chatbot.onAvatarError(this,${size})"
                     style="object-fit:contain;border-radius:50%;">`;
    },

    renderLauncher() {
        return `
            <button id="chatbot-launcher" title="Olélé Copilot" aria-label="Ouvrir l'assistant">
                ${this.renderAvatar(38)}
            </button>
        `;
    },

    renderPanel() {
        return `
            <div id="chatbot-panel" role="dialog" aria-label="Olélé Copilot">
                <div id="chatbot-resize-handle" title="Redimensionner"></div>
                <div id="chatbot-header">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div id="chatbot-avatar">${this.renderAvatar(34)}</div>
                        <div>
                            <div style="font-weight:700;font-size:14px;">Olélé Copilot</div>
                            <div style="font-size:11px;opacity:0.8;">Suivi des projets d'inondation</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:4px;">
                        <button class="chatbot-btn-icon" onclick="Chatbot.toggleMaximize()" title="Agrandir / Réduire" aria-label="Agrandir">
                            <svg id="chatbot-maximize-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                        </button>
                        <button class="chatbot-btn-icon" onclick="Chatbot.clear()" title="Effacer la conversation" aria-label="Effacer">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-2 14H7L5 6"/></svg>
                        </button>
                        <button class="chatbot-btn-icon" onclick="Chatbot.close()" title="Fermer" aria-label="Fermer">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                </div>
                <div id="chatbot-messages"></div>
                <div id="chatbot-input-wrap">
                    <textarea id="chatbot-input" placeholder="Posez votre question..." rows="1" maxlength="2000"></textarea>
                    <button id="chatbot-send" onclick="Chatbot.send()" title="Envoyer" aria-label="Envoyer">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
            </div>
        `;
    },

    toggleMaximize() {
        this.isMaximized = !this.isMaximized;
        document.getElementById('chatbot-panel').classList.toggle('maximized', this.isMaximized);
        const icon = document.getElementById('chatbot-maximize-icon');
        if (icon) {
            icon.innerHTML = this.isMaximized
                ? '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'
                : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
        }
    },

    // Drag-to-resize depuis le coin haut-gauche
    initResize() {
        const panel = document.getElementById('chatbot-panel');
        const handle = document.getElementById('chatbot-resize-handle');
        if (!panel || !handle) return;

        let startX, startY, startW, startH;
        const onMove = (e) => {
            // On agrandit vers la gauche/haut → augmenter width = on tire vers la gauche (dx négatif augmente)
            const dx = startX - e.clientX;
            const dy = startY - e.clientY;
            const newW = Math.max(340, Math.min(window.innerWidth - 32, startW + dx));
            const newH = Math.max(420, Math.min(window.innerHeight - 32, startH + dy));
            panel.style.width = newW + 'px';
            panel.style.height = newH + 'px';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.userSelect = '';
        };
        handle.addEventListener('mousedown', (e) => {
            if (this.isMaximized) return;
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startW = rect.width;
            startH = rect.height;
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    },

    attachEvents() {
        document.getElementById('chatbot-launcher').addEventListener('click', () => this.toggle());

        const input = document.getElementById('chatbot-input');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.send();
            }
        });
        // Auto-grow
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        this.renderMessages();
    },

    toggle() {
        this.isOpen = !this.isOpen;
        const panel = document.getElementById('chatbot-panel');
        const launcher = document.getElementById('chatbot-launcher');
        panel.classList.toggle('open', this.isOpen);
        launcher.classList.toggle('hidden', this.isOpen);
        if (this.isOpen) {
            setTimeout(() => document.getElementById('chatbot-input')?.focus(), 250);
        }
    },

    close() {
        this.isOpen = false;
        document.getElementById('chatbot-panel').classList.remove('open');
        document.getElementById('chatbot-launcher').classList.remove('hidden');
    },

    clear() {
        this.messages = [];
        this.renderMessages();
    },

    async send(predefinedText) {
        const input = document.getElementById('chatbot-input');
        const text = (predefinedText || input.value).trim();
        if (!text || this.isLoading) return;

        this.messages.push({ role: 'user', content: text });
        input.value = '';
        input.style.height = 'auto';
        this.isLoading = true;
        this.renderMessages();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Auth.getToken()}`
                },
                body: JSON.stringify({ messages: this.messages })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || `Erreur HTTP ${res.status}`);
            }
            this.messages.push({ role: 'assistant', content: data.message || '(pas de réponse)' });
        } catch (err) {
            this.messages.push({
                role: 'assistant',
                content: `⚠️ **Erreur :** ${err.message || 'impossible de contacter l\'assistant'}`,
                error: true
            });
        } finally {
            this.isLoading = false;
            this.renderMessages();
        }
    },

    renderMarkdown(text) {
        // Rendu markdown minimal (sans lib côté front pour rester léger)
        if (!text) return '';
        const escape = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        let html = escape(text);

        // code blocks
        html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code}</pre>`);
        // inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // italic
        html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
        // headings
        html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
        // tables (pipe) — rendu basique
        html = html.replace(/(^\|.+\|$(?:\n\|.+\|$)+)/gm, (block) => {
            const lines = block.split('\n').filter(l => l.trim());
            if (lines.length < 2) return block;
            const isSeparator = (l) => /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|$/.test(l);
            const header = lines[0].split('|').slice(1, -1).map(c => c.trim());
            const rows = lines.slice(1).filter(l => !isSeparator(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
            const ths = header.map(h => `<th>${h}</th>`).join('');
            const trs = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
            return `<table class="chat-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
        });
        // unordered lists
        html = html.replace(/(?:^- .+(?:\n|$))+/gm, (block) => {
            const items = block.trim().split('\n').map(l => l.replace(/^- /, '').trim());
            return '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
        });
        // ordered lists
        html = html.replace(/(?:^\d+\. .+(?:\n|$))+/gm, (block) => {
            const items = block.trim().split('\n').map(l => l.replace(/^\d+\. /, '').trim());
            return '<ol>' + items.map(i => `<li>${i}</li>`).join('') + '</ol>';
        });
        // paragraphs
        html = html.split(/\n{2,}/).map(chunk => {
            if (/^<(h\d|ul|ol|pre|table)/.test(chunk.trim())) return chunk;
            return `<p>${chunk.replace(/\n/g, '<br>')}</p>`;
        }).join('');
        return html;
    },

    renderMessages() {
        const container = document.getElementById('chatbot-messages');
        if (!container) return;

        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="chatbot-welcome">
                    <div style="text-align:center;padding:20px 10px;">
                        <div style="margin-bottom:10px;display:flex;justify-content:center;">${this.renderAvatar(56)}</div>
                        <div style="font-weight:700;color:#202B5D;margin-bottom:6px;">Bonjour ${Auth.getUser()?.first_name || ''}, je suis Olélé</div>
                        <div style="font-size:12px;color:#62718D;margin-bottom:16px;line-height:1.5;">
                            Je peux vous aider à consulter l'état des projets, les statistiques, les retards, les priorités...
                        </div>
                    </div>
                    <div style="font-size:11px;color:#8896AB;margin-bottom:8px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Suggestions</div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        ${this.SUGGESTIONS.map(s => `
                            <button class="chatbot-suggestion" onclick="Chatbot.send(${JSON.stringify(s).replace(/"/g, '&quot;')})">${s}</button>
                        `).join('')}
                    </div>
                </div>
            `;
            return;
        }

        const bubbles = this.messages.map((m, idx) => {
            if (m.role === 'user') {
                const safe = m.content.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
                return `<div class="chat-msg chat-msg-user"><div class="chat-bubble chat-bubble-user">${safe}</div></div>`;
            }
            const rendered = this.renderMarkdown(m.content);
            const errClass = m.error ? ' chat-bubble-error' : '';
            const actions = m.error ? '' : `
                <div class="chat-actions">
                    <button class="chat-action-btn" onclick="Chatbot.copyMessage(${idx})" title="Copier" aria-label="Copier">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button class="chat-action-btn" data-speak-index="${idx}" onclick="Chatbot.speakMessage(${idx})" title="Lire à haute voix" aria-label="Lire">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    </button>
                </div>`;
            return `<div class="chat-msg chat-msg-bot">
                        <div class="chat-bubble-wrap">
                            <div class="chat-bubble chat-bubble-bot${errClass}">${rendered}</div>
                            ${actions}
                        </div>
                    </div>`;
        }).join('');

        const typing = this.isLoading ? `
            <div class="chat-msg chat-msg-bot">
                <div class="chat-bubble chat-bubble-bot chat-typing">
                    <span></span><span></span><span></span>
                </div>
            </div>` : '';

        container.innerHTML = bubbles + typing;
        container.scrollTop = container.scrollHeight;
    }
};

// Auto-init au chargement
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Chatbot.init(), 500);
});
// Re-init après login (pour capter le token)
window.addEventListener('auth:login', () => Chatbot.init());
